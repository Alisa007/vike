export { parseConfigValuesImported }

import { assert } from '../../utils.js'
import { assertPlusFileExport } from '../assertPlusFileExport.js'
import type { ConfigValues } from '../PageConfig.js'
import type { ConfigValueImported } from './PageConfigSerialized.js'

function parseConfigValuesImported(configValuesImported: ConfigValueImported[]): ConfigValues {
  const configValues: ConfigValues = {}

  const addConfigValue = (configName: string, value: unknown, importPath: string, exportName: string) => {
    configValues[configName] = {
      value,
      definedAt: {
        // importPath cannot be relative to the current file, since the current file is a virtual file
        filePathToShowToUser: importPath,
        fileExportPathToShowToUser: [configName, 'default'].includes(exportName)
          ? []
          : // Side-effect config
            [exportName]
      }
    }
    assertIsNotNull(value, configName, importPath)
  }

  configValuesImported
    .filter((c) => c.configName !== 'client')
    .forEach((configValueLoaded) => {
      if (configValueLoaded.isValueFile) {
        const { exportValues, importPath, configName } = configValueLoaded
        assertPlusFileExport(exportValues, importPath, configName)
        Object.entries(exportValues).forEach(([exportName, exportValue]) => {
          const isSideExport = exportName !== 'default' // .md files may have "side-exports" such as `export { frontmatter }`
          const configName = isSideExport ? exportName : configValueLoaded.configName
          if (isSideExport && configName in configValues) {
            // We can't avoid side-export conflicts upstream. (Because we cannot know about side-exports upstream at build-time.)
            // Side-exports have the lowest priority.
            return
          }
          addConfigValue(configName, exportValue, importPath, exportName)
        })
      } else {
        const { configName, importPath, exportValue, exportName } = configValueLoaded
        addConfigValue(configName, exportValue, importPath, exportName)
      }
    })

  return configValues
}

function assertIsNotNull(configValue: unknown, configName: string, importPath: string) {
  assert(!importPath.includes('+config.'))
  /* Re-use this for:
   *  - upcoming config.requestPageContextOnNavigation
   *  - for cumulative values in the future: we don't need this for now because, currently, cumulative values are never imported.
  assertUsage(
    configValue !== null,
    `Set ${pc.cyan(configName)} to ${pc.cyan('null')} in a +config.h.js file instead of ${importPath}`
  )
  */
}
