import { useId } from 'react'
import type { BackendPreset } from '../config/backends'

interface Props {
  presets: BackendPreset[]
  url: string
  onUrlChange: (url: string) => void
}

const CUSTOM = 'custom'

export function BackendSelector({ presets, url, onUrlChange }: Props) {
  const selectId = useId()
  const inputId = useId()
  const hintId = useId()
  const selected = presets.find((preset) => preset.url === url)?.id ?? CUSTOM

  return (
    <section className="panel" aria-labelledby={`${selectId}-heading`}>
      <h2 id={`${selectId}-heading`}>Backend</h2>
      <div className="backend-fields">
        <div className="field">
          <label htmlFor={selectId}>Sample configuration</label>
          <select
            id={selectId}
            value={selected}
            onChange={(event) => {
              const preset = presets.find((p) => p.id === event.target.value)
              if (preset) onUrlChange(preset.url)
            }}
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
            <option value={CUSTOM} disabled>
              Custom URL
            </option>
          </select>
        </div>
        <div className="field field--grow">
          <label htmlFor={inputId}>Backend API URL</label>
          <input
            id={inputId}
            type="url"
            inputMode="url"
            spellCheck={false}
            autoComplete="off"
            placeholder="http://localhost:8001"
            value={url}
            aria-describedby={hintId}
            onChange={(event) => onUrlChange(event.target.value)}
          />
        </div>
      </div>
      <p id={hintId} className="hint">
        Sample URLs are suggestions only; start the matching backend first, or type any URL.
      </p>
    </section>
  )
}
