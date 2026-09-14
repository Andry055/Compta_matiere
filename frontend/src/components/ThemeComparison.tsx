export function ThemeComparison() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Theme Test</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-card-foreground mb-2">Card Component</h3>
          <p className="text-muted-foreground">This is muted text in a card.</p>
          <button className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
            Primary Button
          </button>
        </div>
        <div className="bg-secondary rounded-lg p-4">
          <h3 className="text-lg font-semibold text-secondary-foreground mb-2">Secondary Background</h3>
          <p className="text-muted-foreground">Different background with appropriate text.</p>
          <button className="mt-2 px-4 py-2 bg-accent text-accent-foreground rounded hover:bg-accent/90">
            Accent Button
          </button>
        </div>
      </div>
      <div className="bg-muted rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">Colors Test</h3>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="text-foreground">Foreground text</div>
          <div className="text-muted-foreground">Muted foreground</div>
          <div className="text-destructive">Destructive text</div>
        </div>
      </div>
    </div>
  )
}