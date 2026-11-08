#!/bin/bash
# =============================================================================
# nexo_agent.sh v3 — Agente recolector de servicios (100% solo lectura)
#
# Ejecutado por SSH desde el dashboard NexoControl tras autorizar la llave.
# Escanea el equipo: contenedores Docker, servicios systemd relevantes
# (infraestructura web/BD/apps) con estado POR UNIDAD (systemctl show),
# puertos en escucha mapeados por servicio (ss/netstat) y métricas básicas.
# Imprime en stdout UN único objeto JSON válido. El diagnóstico va a stderr.
#
# Garantías:
#   * Solo lectura: ningún comando detiene, reinicia ni modifica nada.
#   * Tolerante a fallos: si Docker/systemctl/ss no existen o fallan, esa
#     sección devuelve un arreglo vacío sin romper el JSON.
#   * Sin dependencias externas (no requiere jq): el escapado JSON es
#     Bash puro. Compatible con GNU y BusyBox (Alpine).
#
# Uso:
#   ssh -i /ruta/llave usuario@ip 'bash -s' < nexo_agent.sh
# =============================================================================

set -u
export LC_ALL="C"
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
umask 077

informe() { printf '%s\n' "$*" >&2; }

# -----------------------------------------------------------------------------
# json_escape: cadena → literal JSON legal (Bash puro).
# -----------------------------------------------------------------------------
json_escape() {
  local valor="$1"
  valor="${valor//\\/\\\\}"
  valor="${valor//\"/\\\"}"
  valor="${valor//$'\t'/\\t}"
  valor="${valor//$'\r'/\\r}"
  valor="${valor//$'\n'/\\n}"
  printf '%s' "$valor"
}

# -----------------------------------------------------------------------------
# Métricas del equipo (sección servidor_info)
# -----------------------------------------------------------------------------
informe "» recolectando métricas del servidor..."

uptime_txt="$(uptime -p 2>/dev/null || uptime 2>/dev/null || true)"
uptime_txt="$(printf '%s' "$uptime_txt" | sed -e 's/^[[:space:]]*up[[:space:]]*//' -e 's/^[[:space:]]*//')"

# CPU %: dos lecturas de /proc/stat separadas por 1 s (solo lectura)
cpu_pct="null"
if [ -r /proc/stat ] && command -v awk >/dev/null 2>&1; then
  lectura1="$(head -n 1 /proc/stat 2>/dev/null || true)"
  sleep 1
  lectura2="$(head -n 1 /proc/stat 2>/dev/null || true)"
  cpu_pct="$(printf '%s\n%s\n' "$lectura1" "$lectura2" | awk '
    NR==1 && NF>=5 { t1=0; for (i=2; i<=NF; i++) t1+=$i; idle1=$5 }
    NR==2 && NF>=5 { t2=0; for (i=2; i<=NF; i++) t2+=$i; idle2=$5
      dt=t2-t1; di=idle2-idle1
      if (dt>0) printf "%d", (100*(dt-di))/dt }')"
  case "$cpu_pct" in
    ''|*[!0-9]*) cpu_pct="null" ;;
  esac
fi

# RAM desde /proc/meminfo (KB): usada = total − disponible
ram_total_mb="null"; ram_usada_mb="null"
if [ -r /proc/meminfo ] && command -v awk >/dev/null 2>&1; then
  ram_total_kb="$(awk '/^MemTotal:/ {print $2; exit}' /proc/meminfo 2>/dev/null)"
  ram_disp_kb="$(awk '/^MemAvailable:/ {print $2; exit}' /proc/meminfo 2>/dev/null)"
  [ -z "$ram_disp_kb" ] && ram_disp_kb="$(awk '/^MemFree:/ {print $2; exit}' /proc/meminfo 2>/dev/null)"
  if [ -n "$ram_total_kb" ] && [ -n "$ram_disp_kb" ]; then
    ram_total_mb="$(awk -v t="$ram_total_kb" 'BEGIN {printf "%d", t/1024 + 0.5}')"
    ram_usada_mb="$(awk -v t="$ram_total_kb" -v d="$ram_disp_kb" 'BEGIN {printf "%d", (t-d)/1024 + 0.5}')"
  fi
fi

informe "» métricas: cpu=${cpu_pct}% ram=${ram_usada_mb}/${ram_total_mb} MB"

# =============================================================================
# Mapa de puertos en ESCUCHA (tcp): "dir:puerto<TAB>proceso<TAB>pid"
# Se resuelve por MainPID de la unidad o por nombre de proceso == unidad.
# Incluye fallback con lsof o sudo si está disponible sin contraseña.
# =============================================================================
informe "» recolectando sockets en escucha (tcp)..."

escuchas_txt=""
if command -v ss >/dev/null 2>&1; then
  escuchas_txt="$(ss -tlnp 2>/dev/null || true)"
  if [ -z "$escuchas_txt" ] && command -v sudo >/dev/null 2>&1; then
    escuchas_txt="$(sudo -n ss -tlnp 2>/dev/null || true)"
  fi
fi
if [ -z "$escuchas_txt" ] && command -v netstat >/dev/null 2>&1; then
  escuchas_txt="$(netstat -tlnp 2>/dev/null || true)"
  if [ -z "$escuchas_txt" ] && command -v sudo >/dev/null 2>&1; then
    escuchas_txt="$(sudo -n netstat -tlnp 2>/dev/null || true)"
  fi
fi

escuchas=""
if [ -n "$escuchas_txt" ]; then
  escuchas="$(printf '%s\n' "$escuchas_txt" | awk '
    $1 == "LISTEN" {
      local = $4; cadena = ""
      for (i = 5; i <= NF; i++) cadena = cadena $i
      pid = ""; nombre = ""
      if (match(cadena, /pid=[0-9]+/)) pid = substr(cadena, RSTART + 4, RLENGTH - 4)
      if (match(cadena, /\("[^"]+"/)) nombre = substr(cadena, RSTART + 2, RLENGTH - 3)
      print local "\t" nombre "\t" pid
      next
    }
    $1 ~ /^tcp/ && $6 == "LISTEN" {
      local = $4; prog = $7
      pid = ""; nombre = ""
      if (match(prog, /^[0-9]+/)) pid = substr(prog, RSTART, RLENGTH)
      if (match(prog, /\/.+$/)) nombre = substr(prog, RSTART + 1, RLENGTH - 1)
      print local "\t" nombre "\t" pid
    }')"
  if [ -n "$escuchas" ]; then
    informe "» $(printf '%s\n' "$escuchas" | wc -l) sockets en escucha detectados"
  else
    informe "» sin sockets parseables; degrada sin puertos"
  fi
else
  informe "» ni ss ni netstat disponibles; sin puertos de escucha"
fi

# puertos_de_unidad(pid base_unit): filtra el mapa por pid o nombre de proceso
puertos_de_unidad() {
  local pid="$1" base="$2"
  if [ -z "$escuchas" ]; then
    # Fallback si no hay mapa de procesos: puertos estándar por servicio bien conocido
    case "$base" in
      nginx|httpd|apache2|caddy|lighttpd) printf '80' ;;
      minio*|s3) printf '9000' ;;
      postgres*|pgsql) printf '5432' ;;
      mysql*|mariadb*) printf '3306' ;;
      redis*) printf '6379' ;;
      mongodb*|mongod) printf '27017' ;;
      elasticsearch|opensearch) printf '9200' ;;
      rabbitmq*) printf '5672' ;;
      *) printf '' ;;
    esac
    return 0
  fi
  local res
  res="$(printf '%s\n' "$escuchas" | awk -v pid="$pid" -v nom="$base" '
    {
      coincide = 0
      if (pid != "" && pid != "0" && $3 == pid) coincide = 1
      if (!coincide && nom != "" && $2 != "" && index($2, nom) > 0) coincide = 1
      if (coincide) acum = acum (acum == "" ? "" : ", ") $1
    }
    END { if (acum != "") print acum }')"
  if [ -z "$res" ]; then
    case "$base" in
      nginx|httpd|apache2|caddy|lighttpd) res="80" ;;
      minio*|s3) res="9000" ;;
      postgres*|pgsql) res="5432" ;;
      mysql*|mariadb*) res="3306" ;;
      redis*) res="6379" ;;
      mongodb*|mongod) res="27017" ;;
      elasticsearch|opensearch) res="9200" ;;
      rabbitmq*) res="5672" ;;
    esac
  fi
  printf '%s' "$res"
}

# =============================================================================
# A) Contenedores Docker (si existe el cliente Y responde el demonio)
# =============================================================================
informe "» recolectando servicios_docker..."

servicios_docker_json="[]"
acum_docker=""
if command -v docker >/dev/null 2>&1; then
  informe "» docker presente; consultando dockerd (solo lectura)..."
  lineas_docker="$(docker ps -a --format '{{.Names}}\t{{.State}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null || true)"
  if [ -n "$lineas_docker" ]; then
    while IFS="$(printf '\t')" read -r d_nombre d_estado d_imagen d_puertos; do
      [ -z "$d_nombre" ] && continue
      item_json="$(printf '{"nombre":"%s","estado":"%s","puertos":"%s","imagen":"%s"}' \
        "$(json_escape "$d_nombre")" "$(json_escape "$d_estado")" \
        "$(json_escape "${d_puertos:-}")" "$(json_escape "$d_imagen")")"
      if [ -z "$acum_docker" ]; then
        acum_docker="$item_json"
      else
        acum_docker="${acum_docker},${item_json}"
      fi
    done <<< "$lineas_docker"
    [ -n "$acum_docker" ] && servicios_docker_json="[${acum_docker}]"
    informe "» docker: contenedores recolectados"
  else
    informe "» dockerd NO responde o sin contenedores; servicios_docker = []"
  fi
else
  informe "» docker NO instalado; servicios_docker = []"
fi

# =============================================================================
# B) Servicios systemd — SOLO infraestructura web/BD/aplicaciones.
#    Lista blanca ANCLADA (inicio y fin) para no casar substrings:
#    kmod-static-nodes no vuelve a casar como "node"; systemd-tpm2 como "pm2".
#    Estado y PID exactos por unidad con `systemctl show` (3 props, 1 llamada).
# =============================================================================
informe "» recolectando servicios_systemd..."

relevantes_ss='^(nginx|apache2?|httpd|lighttpd|caddy|traefik|haproxy|varnish|mysql|mariadb|mysqld|postgres(ql)?(-[0-9]+)?|mongodb?|mongod|redis(-server)?|memcached|elasticsearch|opensearch|kafka|rabbitmq-server|activemq|tomcat[0-9]*|jetty|wildfly|jboss|php[0-9.]*-fpm|pm2|node(-[0-9]+)?|nextjs|nuxt|uwsgi|gunicorn|supervisord|docker|containerd)([@-][[:alnum:]_.-]+)?[.]service$'

servicios_systemd_json="[]"
acum_ss=""
if command -v systemctl >/dev/null 2>&1; then
  informe "» systemd presente; enumerando (solo lectura)..."
  lineas_systemd="$(systemctl list-units --type=service --all --no-legend --no-pager --no-ask-password 2>/dev/null || true)"
  if [ -n "$lineas_systemd" ]; then
    unidades_ss="$(printf '%s\n' "$lineas_systemd" | awk -v RE="$relevantes_ss" '
      {
        if ($1 !~ RE) next
        print $1
      }')"
    if [ -n "$unidades_ss" ]; then
      while IFS= read -r unidad_ss; do
        [ -z "$unidad_ss" ] && continue
        # show --value imprime una línea POR propiedad, en el orden pedido:
        # 1) ActiveState, 2) Description, 3) MainPID.
        salida_show="$(systemctl show --value -p ActiveState -p Description -p MainPID "$unidad_ss" 2>/dev/null || true)"
        ss_estado="$(printf '%s\n' "$salida_show" | sed -n '1p')"
        desc_ss="$(printf '%s\n' "$salida_show" | sed -n '2p')"
        pid_ss="$(printf '%s\n' "$salida_show" | sed -n '3p')"
        [ -z "$ss_estado" ] && ss_estado="unknown"
        base_ss="${unidad_ss%.service}"
        puertos_ss="$(puertos_de_unidad "$pid_ss" "$base_ss")"
        item_json="$(printf '{"nombre":"%s","estado":"%s","puertos":"%s","descripcion":"%s"}' \
          "$(json_escape "$unidad_ss")" "$(json_escape "$ss_estado")" \
          "$(json_escape "${puertos_ss:-}")" "$(json_escape "${desc_ss:-}")")"
        if [ -z "$acum_ss" ]; then
          acum_ss="$item_json"
        else
          acum_ss="${acum_ss},${item_json}"
        fi
      done <<< "$unidades_ss"
      [ -n "$acum_ss" ] && servicios_systemd_json="[${acum_ss}]"
      informe "» systemd: servicios relevantes recolectados con puertos en escucha"
    else
      informe "» sin coincidencias en la lista blanca; servicios_systemd = []"
    fi
  else
    informe "» systemd sin unidades consultables; servicios_systemd = []"
  fi
else
  informe "» systemctl NO disponible (¿Alpine/OpenRC?); servicios_systemd = []"
fi

# =============================================================================
# Salida ÚNICA: JSON al stdout, nada más.
# =============================================================================
informe "» ensamblando JSON y terminando (exit 0)"

printf '{
  "servidor_info": {
    "uptime": "%s",
    "cpu_usage_percent": %s,
    "ram_total_mb": %s,
    "ram_used_mb": %s
  },
  "servicios_docker": %s,
  "servicios_systemd": %s
}\n' \
  "$(json_escape "$uptime_txt")" \
  "$cpu_pct" \
  "$ram_total_mb" \
  "$ram_usada_mb" \
  "$servicios_docker_json" \
  "$servicios_systemd_json"

exit 0
