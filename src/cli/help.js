export function getHelpText() {
  return `
DeployBot — usage
────────────────────────────────────────────────────────────────────────
new path=<folder> date=DD/MM/YYYY name=<owner>
start bot=<id>
stop bot=<id>
restart bot=<id>
remove bot=<id>
set bot=<id> date=DD/MM/YYYY
addday bot=<id> day=<days>
debug bot=<id>
debug bot=<id> lines=<n>
status
clear
help
exit

Examples:
  new path=D:\\bots\\shop date=09/10/2026 name=Alice
  new path="C:\\my bots\\v2" date=31/12/2026 name=Bob
  start bot=1
  stop bot=1
  restart bot=1
  remove bot=1
  set bot=1 date=15/11/2026
  addday bot=1 day=30
  debug bot=1
  debug bot=1 lines=80
`.trim();
}
