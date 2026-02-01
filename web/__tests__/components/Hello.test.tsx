import { render, screen } from '@testing-library/react';

function Hello() {
    return <h1>Hello World</h1>;
}

describe('Hello Component', () => {
    it('renders correctly', () => {
        render(<Hello />);
        expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
});
