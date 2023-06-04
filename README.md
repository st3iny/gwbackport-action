# gwbackport-action

A GitHub action to request backports for Nextcloud apps using the groupware versioning scheme.

## Usage

```yaml
name: gwbackport

on:
  issue_comment:
    types: [created]

jobs:
  run:
    runs-on: ubuntu-latest

    # Only run on pull request comments
    if: contains(github.event.comment.html_url, '/pull/')

    # Is required to add reactions and post comments on the pull request
    permissions:
      pull-requests: write

    steps:
      - uses: st3iny/gwbackport-action@main
        if: contains(github.event.comment.body, '/gwbackport') || contains(github.event.comment.body, '/gwbp')
        with:
          githubToken: ${{ secrets.GITHUB_TOKEN }}
```
