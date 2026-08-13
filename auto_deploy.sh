#!/bin/bash
# unzip & install package
echo "trigger auto deploy!"
echo "unzio and install package"

cd /home/data/TaiChinh
unzip deploy_temp.zip
cd /home/data/TaiChinh/deploy/backend
npm run prod

echo "Stop server!"
pm2 stop family-be

cd /home/data/TaiChinh

echo "remove old deploy!"
rm -rf deploy

echo "Apply temp deploy to main deploy!"
mv "deploy_temp" "deploy"

echo "Restart backend server"
cd /home/data/TaiChinh/deploy/backend
pm2 start ecosystem.config.js

echo "Clean up data..."
cd /home/data/TaiChinh
rm -rf deploy_temp.zip