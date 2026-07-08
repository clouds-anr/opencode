import { Audio, type AudioErrorContext, type AudioPlayOptions, type AudioSound, type AudioVoice } from "@opentui/core"
import { readFile } from "node:fs/promises"

let audio: Audio | null | undefined
const sounds = new Map<string, Promise<AudioSound | null>>()
// ANR: Track user's preferred audio device for attention notifications
let selectedDevicePreference: string | undefined

function getAudio() {
  if (audio !== undefined) return audio
  try {
    const next = Audio.create({ autoStart: false })
    next.on("error", (error: Error, context: AudioErrorContext) => {
      console.debug("tui audio error", { error, context })
    })
    audio = next
    return next
  } catch (error) {
    console.debug("failed to create tui audio", { error })
    audio = null
    return null
  }
}

function selectPlaybackDevice(devicePreference: string): boolean {
  const current = getAudio()
  if (!current) return false
  if (devicePreference === "default") return true

  try {
    const devices = current.listPlaybackDevices()
    if (!devices || devices.length === 0) return false

    let targetDevice = null

    // ANR: Handle platform-specific built-in speaker selection
    if (devicePreference === "builtin-speaker") {
      if (process.platform === "darwin") {
        // ANR: macOS - look for built-in devices
        targetDevice = devices.find(
          (d) =>
            d.name.toLowerCase().includes("builtin") ||
            d.name.toLowerCase().includes("speaker") ||
            d.name.toLowerCase().includes("internal"),
        )
        if (!targetDevice) {
          // ANR: Fallback: find device that's not a headset
          targetDevice = devices.find((d) => {
            const nameLower = d.name.toLowerCase()
            return !nameLower.includes("headset") && !nameLower.includes("airpods") && !nameLower.includes("headphone")
          })
        }
      } else if (process.platform === "win32") {
        // ANR: Windows - typically "Speakers" or contains "speaker"
        targetDevice = devices.find((d) => d.name.toLowerCase() === "speakers")
        if (!targetDevice) {
          targetDevice = devices.find((d) => d.name.toLowerCase().includes("speaker"))
        }
      } else if (process.platform === "linux") {
        // ANR: Linux - try common ALSA/PulseAudio built-in device names
        targetDevice = devices.find((d) => {
          const nameLower = d.name.toLowerCase()
          return (
            nameLower.includes("default") ||
            nameLower.includes("built-in") ||
            nameLower.includes("builtin") ||
            nameLower.includes("speaker")
          )
        })
      }
    } else {
      // Try exact match first, then partial match
      targetDevice = devices.find((d) => d.name === devicePreference)
      if (!targetDevice) {
        targetDevice = devices.find((d) => d.name.toLowerCase().includes(devicePreference.toLowerCase()))
      }
    }

    if (targetDevice) {
      return current.selectPlaybackDevice(targetDevice.index)
    }

    return false
  } catch (error) {
    console.debug("failed to select playback device", { devicePreference, error })
    return false
  }
}

// ANR: Store user's audio device preference from config
export function setAudioDevice(preference: string) {
  selectedDevicePreference = preference
}

// ANR: Retrieve stored audio device preference
export function getAudioDevice(): string | undefined {
  return selectedDevicePreference
}

export function loadSoundFile(file: string) {
  const current = getAudio()
  if (!current) return Promise.resolve(null)
  const cached = sounds.get(file)
  if (cached) return cached
  const task = readFile(file)
    .then((bytes) => current.loadSound(bytes))
    .catch((error) => {
      console.debug("failed to load tui sound", { file, error })
      return null
    })
  sounds.set(file, task)
  return task
}

export function play(sound: AudioSound, options?: AudioPlayOptions) {
  const current = getAudio()
  if (!current) return null
  if (!current.isStarted() && !current.start()) return null

  // ANR: Apply user's audio device preference before playing sound
  if (selectedDevicePreference) {
    selectPlaybackDevice(selectedDevicePreference)
  }

  return current.play(sound, options)
}

export function stopVoice(voice: AudioVoice) {
  return audio?.stopVoice(voice) ?? false
}

export function dispose() {
  audio?.dispose()
  audio = undefined
  sounds.clear()
}
