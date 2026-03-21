import { useEffect, useRef } from 'react'

type SignaturePadProps = {
  value: string
  onChange: (nextValue: string) => void
}

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const hasStrokeRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || value) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.lineWidth = 2
    context.lineCap = 'round'
    context.strokeStyle = '#111827'
    hasStrokeRef.current = false
  }, [value])

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  function snapshot() {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokeRef.current) return
    onChange(canvas.toDataURL('image/png'))
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const point = getPoint(event)
    drawingRef.current = true
    hasStrokeRef.current = true
    canvas.setPointerCapture(event.pointerId)
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const point = getPoint(event)
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    drawingRef.current = false
    canvas.releasePointerCapture(event.pointerId)
    snapshot()
  }

  return (
    <div className="signature-shell">
      <div className="signature-header">
        <p className="signature-note">Recipient signature</p>
        <p className="signature-copy">Ask the receiver to sign clearly inside the box below.</p>
      </div>
      <div className="signature-stage">
        <canvas
          ref={canvasRef}
          width={720}
          height={220}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            drawingRef.current = false
          }}
          className="signature-canvas"
        />
      </div>
      <div className="signature-toolbar">
        <button
          type="button"
          onClick={() => onChange('')}
          className="btn-quiet"
        >
          Clear signature
        </button>
        <span className="signature-toolbar-copy">
          Draw with a mouse, trackpad, or touch.
        </span>
      </div>
      {value ? (
        <div className="signature-preview-card">
          <p className="signature-note">Preview</p>
          <img
            src={value}
            alt="Signature preview"
            className="signature-preview-image"
          />
        </div>
      ) : null}
    </div>
  )
}
