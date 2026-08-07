#fontend
Copy-Item "frontend/dist" "deploy/frontend" -Recurse -Force

#zip
powershell -Command "Compress-Archive -Path 'deploy/frontend' -DestinationPath 'frontend.zip' -Force"

#copy to server
scp frontend.zip root@server:/home/data/TaiChinh/deploy