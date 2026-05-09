---
name: vouchix-push
description: Use this skill when the user says "push", "push to GitHub", "save to GitHub", "push the project", or "deploy" in the VouchiX project. Handles merging all worktree branches into master and pushing to https://github.com/haim3010/Vouchix.git
version: 1.0.0
---

# VouchiX Push to GitHub

Pushes the latest VouchiX code to https://github.com/haim3010/Vouchix.git

## Steps

1. **Check all branches** — find the most advanced claude/* branch:
   ```
   git log --oneline -3 <each-branch>
   ```

2. **Merge all branches into master** — each claude/* branch may have unique features:
   ```
   git checkout master
   git merge claude/<branch-name> --no-edit
   ```
   If blocked by untracked files, remove them first (metro.config.js, assets that conflict).

3. **Push to remote**:
   ```
   git push origin master
   ```
   Remote: `https://github.com/haim3010/Vouchix.git`
   Collaborator token: stored in git remote URL as `amitcohen681-cyber`

## Important notes
- Always merge ALL claude/* branches — features are often spread across multiple diverged sessions
- If port 8081 is busy when starting, kill with: `netstat -ano | findstr :8081` then `Stop-Process -Id <pid> -Force`
- Start command: `npx expo start --web --clear` from `C:\Users\amitc\repo\VouchiX`
- Flag images: use flagcdn.com URLs — Windows/Chrome doesn't render flag emoji
