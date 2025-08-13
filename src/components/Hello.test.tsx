import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Hello from './Hello'

describe('Hello component', () => {
  it('renders with default name', () => {
    render(<Hello />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello, World!')
  })

  it('renders with provided name and increments button', async () => {
    const user = userEvent.setup()
    render(<Hello name="Ben" />)
    const btn = screen.getByRole('button', { name: /clicked/i })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello, Ben!')
    await user.click(btn)
    await user.click(btn)
    expect(btn).toHaveTextContent('Clicked 2 times')
  })
})
