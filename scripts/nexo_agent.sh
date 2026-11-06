#!/bin/bash
# =============================================================================
# nexo_agent.sh — Agente recolector de servicios (100% solo lectura)
#
# Ejecutado por SSH desde el dashboard NexoControl tras autorizar la llave.
# Escanea el equipo: contenedores Docker, servicios systemd relevantes
# (infraestructura web/BD/apps) y métricas básicas; imprime en stdout
# UN único objeto JSON válido. El diagnóstico va a stderr.
#
# Garantías:
#   * Solo lectura: ningún comando detiene, reinicia ni modifica nada.
#   * Tolerante a fallos: si Docker no existe o systemd no responde, esa
#     sección devuelve un arreglo vacío sin romper el JSON.
#   * Sin dependencias externas (no requiere jq): el escapado JSON es
#     Bash puro. Compatible con GNU y BusyBox (Alpine).
#
# Uso (directo o vía SSH):
#   bash nexo_agent.sh
#   ssh -i /ruta/llave usuario@ip 'bash -s' < nexo_agent.sh
# =============================================================================

set -u        # error por variable no definida
# (sin set -e: el objetivo es degradar con gracia, no abortar)
export LC_ALL="C"
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
umask 077

informe() { printf '%s\n' "$*" >&2; }  # log de diagnóstico → stderr SIEMPRE

# -----------------------------------------------------------------------------
# json_escape: cadena → literal JSON legal (Bash puro):
# barra invertida, comillas, tabulación, CR y LF.
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
# B) Servicios systemd (solo infraestructura web/BD/aplicaciones)
#    Lista blanca: evita saturar el payload con unidades base del SO
#    (systemd-*, journald, cron, dbus...).
# =============================================================================
informe "» recolectando servicios_systemd..."

relevantes_ss='nginx|apache|httpd|lighttpd|caddy|traefik|haproxy|varnish|mysql|mariadb|postgres|mongo|redis|memcached|elasticsearch|opensearch|kafka|rabbitmq|activemq|tomcat|jetty|wildfly|jboss|php-fpm|pm2|node|nextjs|nuxt|django|uwsgi|gunicorn|python|java|supervisord|docker'

servicios_systemd_json="[]"
acum_ss=""
if command -v systemctl >/dev/null 2>&1; then
  informe "» systemd presente; consultando (solo lectura)..."
  lineas_systemd="$(systemctl list-units --type=service --all --no-legend --no-pager --no-ask-password 2>/dev/null || true)"
  if [ -n "$lineas_systemd" ]; then
    filas_ss="$(printf '%s\n' "$lineas_systemd" | awk -v RE="$relevantes_ss" '
      {
        unidad=$1; estado=$3
        if (unidad !~ RE) next
        print unidad "\t" estado
      }')"
    if [ -n "$filas_ss" ]; then
      while IFS="$(printf '\t')" read -r ss_nombre ss_estado; do
        [ -z "$ss_nombre" ] && continue
        desc="$(systemctl show --property=Description --value "$ss_nombre" 2>/dev/null || true)"
        item_json="$(printf '{"nombre":"%s","estado":"%s","descripcion":"%s"}' \
          "$(json_escape "$ss_nombre")" "$(json_escape "${ss_estado:-unknown}")" \
          "$(json_escape "${desc:-}")")"
        if [ -z "$acum_ss" ]; then
          acum_ss="$item_json"
        else
          acum_ss="${acum_ss},${item_json}"
        fi
      done <<< "$filas_ss"
      [ -n "$acum_ss" ] && servicios_systemd_json="[${acum_ss}]"
      informe "» systemd: servicios relevantes recolectados"
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
