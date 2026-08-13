#!/bin/bash
# unzip & install package
echo "trigger auto deploy!"
echo "unzip deploy folder"

cd /home/data/TaiChinh
unzip deploy_temp.zip
echo "Remove Zip file"
rm -rf deploy_temp.zip

echo "Initial backend!"
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