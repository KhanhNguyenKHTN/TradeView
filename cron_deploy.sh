#!/bin/bash
#crontab -e
#* * * * * flock -n /home/data/TaiChinh/kt-deploy.lock /home/data/TaiChinh/cron_deploy.sh
DEPLOY_DIR="/home/data/TaiChinh"
ZIP_FILE="$DEPLOY_DIR/deploy_temp.zip"
DEPLOY_SCRIPT="$DEPLOY_DIR/auto_deploy.sh"
LOG_FILE="$DEPLOY_DIR/deploy.log"

echo "$(date '+%Y-%m-%d %H:%M:%S') cron_deploy START PID=$$" >> "$LOG_FILE"
if [ -f "$ZIP_FILE" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Found deploy_temp.zip, starting deploy..." >> "$LOG_FILE"

    /bin/bash "$DEPLOY_SCRIPT" >> "$LOG_FILE" 2>&1

    EXIT_CODE=$?

    if [ "$EXIT_CODE" -eq 0 ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Deploy completed." >> "$LOG_FILE"
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Deploy failed, exit code: $EXIT_CODE" >> "$LOG_FILE"
    fi
fi
echo "$(date '+%Y-%m-%d %H:%M:%S') cron_deploy END PID=$$" >> "$LOG_FILE"