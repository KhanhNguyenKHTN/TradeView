#!/bin/bash
export PATH="/root/.nvm/versions/node/v21.7.3/bin:/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin"

echo "Node: $(node -v)"
echo "NPM: $(npm -v)"
echo "PM2: $(which pm2)"

echo "trigger auto deploy!"
# unzip & install package
echo "unzip deploy folder"

cd /home/data/TaiChinh
unzip -oq deploy_temp.zip

echo "Initial backend!"
cd /home/data/TaiChinh/deploy_temp/backend
npm install --omit=dev --silent 1>/dev/null
npm run prisma:gd

echo "Stop server!"
pm2 stop family-be

cd /home/data/TaiChinh
echo "remove old deploy!"
rm -rf deploy

echo "Remove Zip file"
rm -rf deploy_temp.zip

echo "Apply temp deploy to main deploy!"
mv "deploy_temp" "deploy"

echo "Restart backend server"
pm2 start family-be