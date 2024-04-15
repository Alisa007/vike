export { getPageContextExports }
export type { ExportsAll }
export type { PageContextExports }
export type { ConfigEntries }

import { isScriptFile, isTemplateFile } from '../../utils/isScriptFile.js'
import { assert, isObject, assertWarning, assertUsage, makeLast, isBrowser } from '../utils.js'
import { assertDefaultExports, forbiddenDefaultExports } from './assert_exports_old_design.js'
import type { FileType } from './fileTypes.js'
import type { PageConfigRuntimeLoaded } from './../page-configs/PageConfig.js'
import type { PageFile } from './getPageFileObject.js'
import { getConfigDefinedAtString, getConfigValueFilePathToShowToUser } from '../page-configs/helpers.js'
import pc from '@brillout/picocolors'

// TODO/v1-release: remove
type ExportsAll = Record<
  string,
  {
    exportValue: unknown
    exportSource: string
    filePath: string | null
    /** @deprecated */
    _fileType: FileType | null
    /** @deprecated */
    _isFromDefaultExport: boolean | null
    /** @deprecated */
    _filePath: string | null
  }[]
>
/** All the config's values (including overriden ones) and where they come from.
 *
 * https://vike.dev/pageContext
 */
type ConfigEntries = Record<
  string,
  {
    configValue: unknown
    configDefinedAt: string
    configDefinedByFile: string | null
  }[]
>
type PageContextExports = {
  config: Record<string, unknown>
  configEntries: ConfigEntries
  exports: Record<string, unknown>
  exportsAll: ExportsAll
  /** @deprecated */
  pageExports: Record<string, unknown>
}

function getPageContextExports(pageFiles: PageFile[], pageConfig: PageConfigRuntimeLoaded | null): PageContextExports {
  const configEntries: ConfigEntries = {}
  const config: Record<string, unknown> = {}
  const exportsAll: ExportsAll = {}

  // V0.4 design
  // TODO/v1-release: remove
  pageFiles.forEach((pageFile) => {
    const exportValues = getExportValues(pageFile)
    exportValues.forEach(({ exportName, exportValue, isFromDefaultExport }) => {
      assert(exportName !== 'default')
      exportsAll[exportName] = exportsAll[exportName] ?? []
      exportsAll[exportName]!.push({
        exportValue,
        exportSource: `${pageFile.filePath} > ${
          isFromDefaultExport ? `\`export default { ${exportName} }\`` : `\`export { ${exportName} }\``
        }`,
        filePath: pageFile.filePath,
        _filePath: pageFile.filePath, // TODO/next-major-release: remove
        _fileType: pageFile.fileType,
        _isFromDefaultExport: isFromDefaultExport
      })
    })
  })

  // V1 design
  if (pageConfig) {
    Object.entries(pageConfig.configValues).forEach(([configName, configValue]) => {
      const { value } = configValue
      const configValueFilePathToShowToUser = getConfigValueFilePathToShowToUser(configValue.definedAt)
      const configDefinedAt = getConfigDefinedAtString('Config', configName, configValue)

      config[configName] = config[configName] ?? value
      configEntries[configName] = configEntries[configName] ?? []
      // Currently each configName has only one entry. Adding an entry for each overriden config value isn't implemented yet. (This is an isomorphic file and it isn't clear whether this can/should be implemented on the client-side. We should load a minimum amount of code on the client-side.)
      assert(configEntries[configName]!.length === 0)
      configEntries[configName]!.push({
        configValue: value,
        configDefinedAt,
        configDefinedByFile: configValueFilePathToShowToUser
      })

      // TODO/v1-release: remove
      const exportName = configName
      exportsAll[exportName] = exportsAll[exportName] ?? []
      exportsAll[exportName]!.push({
        exportValue: value,
        exportSource: configDefinedAt,
        filePath: configValueFilePathToShowToUser,
        _filePath: configValueFilePathToShowToUser,
        _fileType: null,
        _isFromDefaultExport: null
      })
    })
  }

  const pageExports = createObjectWithDeprecationWarning()
  const exports: Record<string, unknown> = {}
  Object.entries(exportsAll).forEach(([exportName, values]) => {
    values.forEach(({ exportValue, _fileType, _isFromDefaultExport }) => {
      exports[exportName] = exports[exportName] ?? exportValue

      // Legacy pageContext.pageExports
      if (_fileType === '.page' && !_isFromDefaultExport) {
        if (!(exportName in pageExports)) {
          pageExports[exportName] = exportValue
        }
      }
    })
  })

  assert(!('default' in exports))
  assert(!('default' in exportsAll))

  const pageContextExports = {
    config,
    configEntries,
    // TODO/v1-release: remove
    exports,
    exportsAll,
    pageExports
  }
  return pageContextExports
}

function getExportValues(pageFile: PageFile) {
  const { filePath, fileExports } = pageFile
  assert(fileExports) // assume pageFile.loadFile() was called
  assert(isScriptFile(filePath))

  const exportValues: {
    exportName: string
    exportValue: unknown
    isFromDefaultExport: boolean
  }[] = []

  Object.entries(fileExports)
    .sort(makeLast(([exportName]) => exportName === 'default')) // `export { bla }` should override `export default { bla }`
    .forEach(([exportName, exportValue]) => {
      let isFromDefaultExport = exportName === 'default'

      if (isFromDefaultExport) {
        if (isTemplateFile(filePath)) {
          exportName = 'Page'
        } else {
          assertUsage(isObject(exportValue), `The ${pc.cyan('export default')} of ${filePath} should be an object.`)
          Object.entries(exportValue).forEach(([defaultExportName, defaultExportValue]) => {
            assertDefaultExports(defaultExportName, filePath)
            exportValues.push({
              exportName: defaultExportName,
              exportValue: defaultExportValue,
              isFromDefaultExport
            })
          })
          return
        }
      }

      exportValues.push({
        exportName,
        exportValue,
        isFromDefaultExport
      })
    })

  exportValues.forEach(({ exportName, isFromDefaultExport }) => {
    assert(!(isFromDefaultExport && forbiddenDefaultExports.includes(exportName)))
  })

  return exportValues
}

// TODO/v1-release: remove
function createObjectWithDeprecationWarning(): Record<string, unknown> {
  return new Proxy(
    {},
    {
      get(...args) {
        // We only show the warning in Node.js because when using Client Routing Vue integration uses `Object.assign(pageContextReactive, pageContext)` which will wrongully trigger the warning. There is no cross-browser way to catch whether the property accessor was initiated by an `Object.assign()` call.
        if (!isBrowser()) {
          assertWarning(
            false,
            '`pageContext.pageExports` is outdated. Use `pageContext.exports` instead, see https://vike.dev/exports',
            { onlyOnce: true, showStackTrace: true }
          )
        }
        return Reflect.get(...args)
      }
    }
  )
}
