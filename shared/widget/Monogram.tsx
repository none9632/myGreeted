import { inkCentre } from "./inkCentre"

// A disc with the first letter of a name — standing in for the avatar this system
// does not have. The disc is the box; the letter inside it is centred by its ink
// rather than by its advance box — see inkCentre.ts.
export default function Monogram({ name }: { name: string }) {
  const letter = (name.trim()[0] ?? "?").toUpperCase()
  return (
    <box cssName="monogram" layoutManager={inkCentre()}>
      <label label={letter} />
    </box>
  )
}
