/**
 * Automatic dependency detection for ANR OpenCode
 * Analyzes code to detect and suggest missing dependencies
 */

export interface Dependency {
  name: string
  type: "npm" | "bun" | "python" | "system"
  version?: string
  detected: boolean
  installed: boolean
}

/**
 * Detect imports/requires from code content
 */
export function detectDependenciesFromCode(code: string, language: string): Dependency[] {
  const dependencies: Dependency[] = []

  if (language === "typescript" || language === "javascript") {
    // ES6 imports
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(code)) !== null) {
      const pkg = match[1]
      if (!pkg.startsWith(".") && !pkg.startsWith("/")) {
        dependencies.push({
          name: pkg.split("/")[0] || pkg,
          type: "npm",
          detected: true,
          installed: false, // Check this against package.json
        })
      }
    }

    // CommonJS requires
    const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g
    while ((match = requireRegex.exec(code)) !== null) {
      const pkg = match[1]
      if (!pkg.startsWith(".") && !pkg.startsWith("/")) {
        dependencies.push({
          name: pkg.split("/")[0] || pkg,
          type: "npm",
          detected: true,
          installed: false,
        })
      }
    }
  } else if (language === "python") {
    // Python imports
    const pythonImportRegex = /(?:from|import)\s+([a-zA-Z0-9_]+)/g
    let match
    while ((match = pythonImportRegex.exec(code)) !== null) {
      dependencies.push({
        name: match[1],
        type: "python",
        detected: true,
        installed: false,
      })
    }
  }

  // Remove duplicates
  const unique = new Map<string, Dependency>()
  for (const dep of dependencies) {
    if (!unique.has(dep.name)) {
      unique.set(dep.name, dep)
    }
  }

  return Array.from(unique.values())
}

/**
 * Check if dependencies are installed
 */
export async function checkInstalledDependencies(
  dependencies: Dependency[]
): Promise<Dependency[]> {
  const checked = []

  for (const dep of dependencies) {
    let installed = false

    try {
      if (dep.type === "npm" || dep.type === "bun") {
        // Try to require/import it
        await import(dep.name)
        installed = true
      } else if (dep.type === "python") {
        // Check if python module exists
        const proc = Bun.spawn(["python", "-c", `import ${dep.name}`], {
          stderr: "pipe",
        })
        await proc.exited
        installed = proc.exitCode === 0
      }
    } catch {
      installed = false
    }

    checked.push({ ...dep, installed })
  }

  return checked
}

/**
 * Get missing dependencies from code
 */
export async function getMissingDependencies(
  code: string,
  language: string
): Promise<Dependency[]> {
  const detected = detectDependenciesFromCode(code, language)
  const checked = await checkInstalledDependencies(detected)
  return checked.filter(dep => !dep.installed)
}

/**
 * Generate installation command for missing dependencies
 */
export function generateInstallCommand(dependencies: Dependency[]): string {
  const npm = dependencies.filter(d => d.type === "npm" || d.type === "bun")
  const python = dependencies.filter(d => d.type === "python")

  const commands: string[] = []

  if (npm.length > 0) {
    commands.push(`bun add ${npm.map(d => d.name).join(" ")}`)
  }

  if (python.length > 0) {
    commands.push(`pip install ${python.map(d => d.name).join(" ")}`)
  }

  return commands.join(" && ")
}
