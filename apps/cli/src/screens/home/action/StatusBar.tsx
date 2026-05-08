import { Box, Spacer, Text } from "ink"
import { readFileSync } from "node:fs"

export interface StatusBarProps {
  busy: boolean,
  model: string,
  cwd: string
}
export function StatusBar({ busy, model, cwd }: StatusBarProps) {
  return (
    <Box width={"100%"} justifyContent="space-between">
      <Box>
        {/*ink 不能这样写😡 {[
          <Text>model={model}</Text>,
          <Text>cwd={cwd}</Text>
        ].join(<Text color="gray"> </Text>)} */}
        <Text>{[`model=${model}`, `cwd=${cwd}`].join(" ")}</Text>
      </Box>
      <Box>
        {busy ?
          <Text color="yellow">⚡ thinking...</Text> :
          <Text color="grey">yaca v{JSON.parse(readFileSync("package.json", "utf-8")).version}</Text>
        }
      </Box>
    </Box>
  )
}