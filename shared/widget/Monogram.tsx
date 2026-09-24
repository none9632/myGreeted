// Диск с первой буквой имени — замена аватарке, которой в системе нет.
export default function Monogram({ name }: { name: string }) {
  const letter = (name.trim()[0] ?? "?").toUpperCase()
  return <label cssName="monogram" label={letter} />
}
