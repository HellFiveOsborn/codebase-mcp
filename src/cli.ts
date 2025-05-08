#!/usr/bin/env node
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

/**
 * Entry point for the codebase-mcp CLI
 */

// Get the equivalent of __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// The first arg after node executable and script name
const command = process.argv[2];

if (!command) {
  console.log(chalk.cyan('Usage: ') + chalk.bold('codebase-mcp <command>'));
  console.log(chalk.cyan('Commands:'));
  console.log(chalk.green('  start   ') + '- Start the MCP server');
  console.log(chalk.green('  install ') + '- Install Repomix globally');
  console.log(chalk.green('  version ') + '- Show version information');
  process.exit(1);
}

switch (command.toLowerCase()) {
  case 'start':
    console.log(chalk.green('Starting Codebase MCP Server...'));
    try {
      // Use dynamic import instead of require
      import('./tools/codebase.js').catch((err) => {
        console.error(chalk.red('Failed to import MCP server:'), err);
        process.exit(1);
      });
    } catch (err) {
      console.error(chalk.red('Failed to start MCP server:'), err);
      process.exit(1);
    }
    break;

  case 'install':
    console.log(chalk.yellow('Installing Repomix globally...'));
    try {
      execSync('npm install -g repomix', { stdio: 'inherit' });
      console.log(chalk.green('Repomix installed successfully!'));
    } catch (err) {
      console.error(chalk.red('Failed to install Repomix:'), err);
      process.exit(1);
    }
    break;

  case 'version':
    try {
      // Read package.json using fs instead of require
      const packageJsonPath = join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      console.log(chalk.cyan(`codebase-mcp version: `) + chalk.bold(packageJson.version));
      try {
        const repomixVersion = execSync('npx repomix --version').toString().trim();
        console.log(chalk.cyan(`Repomix version: `) + chalk.bold(repomixVersion));
      } catch {
        // Ignore error and just show Repomix is not available
        console.log(chalk.yellow('Repomix is not installed or not available in PATH'));
      }
    } catch (err) {
      console.error(chalk.red('Failed to get version information:'), err);
      process.exit(1);
    }
    break;

  default:
    console.log(chalk.red(`Unknown command: ${command}`));
    console.log(chalk.cyan('Usage: ') + chalk.bold('codebase-mcp <command>'));
    console.log(chalk.cyan('Commands:'));
    console.log(chalk.green('  start   ') + '- Start the MCP server');
    console.log(chalk.green('  install ') + '- Install Repomix globally');
    console.log(chalk.green('  version ') + '- Show version information');
    process.exit(1);
}
