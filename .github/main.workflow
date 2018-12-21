workflow "Build, lint and test" {
  on = "push"
  resolves = ["Test", "Lint"]
}

action "Build" {
  uses = "docker://node:10"
  runs = "yarn"
}

action "Boot" {
  uses = "docker://node:10"
  needs = ["Build"]
  runs = "yarn"
  args = "boot"
}

action "Test" {
  uses = "docker://node:10"
  needs = ["Boot"]
  runs = "yarn"
  args = "test"
}

action "Lint" {
  uses = "docker://node:10"
  needs = ["Boot"]
  runs = "yarn"
  args = "lint"
}
