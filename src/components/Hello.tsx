import { useState } from 'react'

export default function Hello({ name = 'World' }: { name?: string }) {
  const [count, setCount] = useState(0)
  return (
    <div>
      <h1>Hello, {name}!</h1>
      <button onClick={() => setCount((c) => c + 1)}>
        Clicked {count} times
      </button>
    </div>
  )
}
