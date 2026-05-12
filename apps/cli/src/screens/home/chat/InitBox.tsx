import { YACA_VERSION } from "@yaca/agent-core/constants/path.js";
import { Box, Text } from "ink";

export function InitBox() {
  return (
    <Box alignItems="center" justifyContent="center" borderStyle="round" borderColor="gray" padding={1} marginBottom={1}>
      {/* 诶所以之前用 wrap="wrap" 接近不了是没用 raw 吗？ */}
      <Text color="gray">{String.raw`
        ▄██████▄                    _____
    ▄████████████▄                 / ____|    /\
  ▄████▀     ▀████▄  _   _   __ _ | |        /  \
████          ████  | | | | / _\`|| |       / /\ \
 ██      ▅    ███   | |_| || (_| || |____  / ____ \
  ██          ██     \__, | \__,_| \_____|/_/    \_\
  ███▄      ▄██       __/ |
    ▀████████▀       |___/            yaCA v${YACA_VERSION}
`}</Text>
    </Box>
  )
}