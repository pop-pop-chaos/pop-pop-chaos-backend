#!/bin/bash

DEST_USER="dh_byam88"
DEST_HOST="ppc"
DEST_PATH="/home/$DEST_USER/ppb.chatforest.com/"

# Monitor file and directory changes
inotifywait --exclude '.git/*' -mr -e close_write,create --format '%e %w%f' . | while read EVENT FULLPATH; do
    RELPATH="${FULLPATH#./}"  # remove leading './'
    REMOTE="$DEST_PATH$RELPATH"

    # Skip temporary files created by editors (including Claude Code)
    if [[ "$FULLPATH" == *.tmp.* ]] || [[ "$FULLPATH" == *~ ]] || [[ "$FULLPATH" == *.swp ]] || [[ "$FULLPATH" == *.swo ]]; then
        # echo "Skipping temporary file: $FULLPATH"
        continue
    fi

    # Skip if file doesn't exist (was a temporary file that got cleaned up)
    if [[ ! -f "$FULLPATH" ]]; then
        # echo "Skipping non-existent file: $FULLPATH"
        continue
    fi

    if [[ "$EVENT" == *"ISDIR"* ]]; then
        echo "Creating directory: $RELPATH"
        ssh $DEST_USER@$DEST_HOST mkdir -p $REMOTE
    elif [[ "$EVENT" == *"CLOSE_WRITE"* ]]; then
        echo "Copying file: $RELPATH"
        scp $FULLPATH $DEST_USER@$DEST_HOST:$REMOTE
    fi
done
