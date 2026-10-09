export function getHelpText() {
  return `
DeployBot — usage
────────────────────────────────────────────────────────────────────────
new path=<folder> day=<days> name=<owner>
start bot=<id>
stop bot=<id>
restart bot=<id>
remove bot=<id>
set bot=<id> date=DD/MM/YYYY
addday bot=<id> day=<days>
adddayall day=<days>
debug bot=<id>
debug bot=<id> lines=<n>
status
clear
help
exit

Examples:
  new path=D:\\bots\\shop day=30 name=Alice
  new path="C:\\my bots\\v2" day=90 name=Bob
  start bot=1
  stop bot=1
  restart bot=1
  remove bot=1
  set bot=1 date=15/11/2026
  addday bot=1 day=30
  adddayall day=1
  debug bot=1
  debug bot=1 lines=80
`.trim();
}
