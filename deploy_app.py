import sys
sys.path.insert(0, 'execution')
from coolify_manager import CoolifyManager
import time

manager = CoolifyManager()

APP_UUID = "gqe0clxgeedygjtnwqzpagpw"

# Trigger deployment
print("Starting deployment...")
result = manager.deploy_application(APP_UUID)
if not result:
    print("Failed to start deployment")
    sys.exit(1)

deployment_uuid = result.get("deployments", [{}])[0].get("deployment_uuid")
print(f"Deployment UUID: {deployment_uuid}")

# Wait and monitor
print("\nWaiting for deployment to complete (this may take a few minutes)...")
time.sleep(60)

max_wait = 600  # 10 minutes max
waited = 0
while waited < max_wait:
    status_info = manager.get_deployment_status(deployment_uuid)
    status = status_info.get("status")
    logs = status_info.get("logs", [])

    print(f"\n--- Status: {status} (waited {waited}s) ---")
    for log in logs[-10:]:  # Show last 10 logs
        print(f"  {log}")

    if status in ["finished", "success"]:
        print("\n✅ Deployment finished successfully!")
        break
    elif status in ["failed", "error"]:
        print("\n❌ Deployment failed!")
        break

    time.sleep(30)
    waited += 30

# Final status
final_status = manager.get_deployment_status(deployment_uuid)
print(f"\nFinal status: {final_status.get('status')}")
for log in final_status.get("logs", [])[-20:]:
    print(f"  {log}")