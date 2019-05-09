workflow "Build, lint and test" {
  on = "push"
  resolves = [
    "Test projects",
    "Build projects",
    "Lint projects"
  ]
}

action "Don't skip CI" {
  uses = "ffflorian/actions/skip-ci-check@master"
}

action "Install dependencies" {
  uses = "docker://node:11-slim"
  needs = "Don't skip CI"
  runs = "yarn"
}

action "Bootstrap projects" {
  uses = "docker://node:11-slim"
  needs = ["Install dependencies"]
  runs = "yarn"
  args = "boot"
}

action "Test projects" {
  uses = "docker://node:11-slim"
  needs = ["Bootstrap projects"]
  runs = "yarn"
  args = "test:all"
}

action "Lint projects" {
  uses = "docker://node:11-slim"
  needs = ["Bootstrap projects"]
  runs = "yarn"
  args = "lint"
}

action "Build projects" {
  uses = "docker://node:11-slim"
  needs = ["Bootstrap projects"]
  runs = "yarn"
  args = "dist"
}
