#!/usr/bin/env node

const git = require('git-state');
const path = require('path');
const chalk = require('chalk');

const dirtyCount = git.dirtySync(path.resolve(__dirname, 'lib'));

if (dirtyCount) {
  console.error(chalk.red('\n\n\n------------------------------------\nbuild artifacts should be committed!\n------------------------------------\n\n\n'));
}

process.exit(dirtyCount === 0 ? 0 : 1);
