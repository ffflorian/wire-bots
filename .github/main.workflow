workflow "Build, lint and test" {
  on = "push"
  resolves = [
    "Test projects",
    "Build projects",
    "Lint projects"
  ]
}

action "Don't skip CI" {
  uses = "ffflorian/actions/last_commit@master"
  args = "^(?:(?!\\[(ci skip|skip ci)\\]).)*$"
}

action "Install dependencies" {
  uses = "docker://node:11"
  needs = "Don't skip CI"
  runs = "yarn"
}

action "Bootstrap projects" {
  uses = "docker://node:11"
  needs = ["Install dependencies"]
  runs = "yarn"
  args = "boot"
}

action "Test projects" {
  uses = "docker://node:11"
  needs = ["Bootstrap projects"]
  runs = "yarn"
  args = "test"
}

action "Lint projects" {
  uses = "docker://node:11"
  needs = ["Bootstrap projects"]
  runs = "yarn"
  args = "lint"
}

action "Build projects" {
  uses = "docker://node:11"
  needs = ["Bootstrap projects"]
  runs = "yarn"
  args = "dist"
}
