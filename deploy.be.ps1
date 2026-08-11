#backend
Copy-Item "backend/dist" "deploy/backend" -Recurse -Force
Copy-Item "backend/prisma" "deploy/backend/prisma" -Recurse -Force
Copy-Item "backend/ecosystem.config.js" "deploy/backend" -Force
Copy-Item "backend/package.json" "deploy/backend" -Force
Copy-Item "backend/package-lock.json" "deploy/backend" -Force
Copy-Item "backend/.env" "deploy/backend/.env" -Force

#zip
powershell -Command "Compress-Archive -Path 'deploy/backend' -DestinationPath 'backend.zip' -Force"

#copy to server
scp backend.zip root@server:/home/data/TaiChinh/deploy

#install package in server
#npm ci --omit=dev