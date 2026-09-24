// A disc with the first letter of a name — standing in for the avatar this system
// does not have.
export default function Monogram({ name }: { name: string }) {
  const letter = (name.trim()[0] ?? "?").toUpperCase()
  return <label cssName="monogram" label={letter} />
}
