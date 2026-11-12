import sys
sys.path.insert(0, 'execution')
from coolify_manager import CoolifyManager
manager = CoolifyManager()
print('URL:', manager.url)
print('Token present:', bool(manager.token))
print('Project UUID:', manager.project_uuid)
apps = manager.get_scoped_applications()
print(f'Found {len(apps)} applications')
for app in apps:
    name = app.get('name')
    uuid = app.get('uuid')
    fqdn = app.get('fqdn', 'none')
    print(f'  - {name} (uuid: {uuid}, fqdn: {fqdn})')