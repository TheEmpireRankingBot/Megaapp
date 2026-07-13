import { Cake, Gift, MessageCircle, UserRoundPlus, X } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { formatDay } from "@/lib/dates";
import { getPeople } from "@/lib/people";
import { addGiftIdea, createPerson, deleteItem, logPersonContact } from "@/lib/actions";

export const metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const user = await getCurrentUser();
  const people = await getPeople(user.id);
  const birthdays = people.filter((person) => person.birthdayInDays !== null && person.birthdayInDays <= 30).sort((a, b) => (a.birthdayInDays ?? 999) - (b.birthdayInDays ?? 999));
  const reconnect = people.filter((person) => person.needsContact).sort((a, b) => b.daysSinceContact - a.daysSinceContact);

  return (
    <div className="space-y-8">
      <header><h1 className="text-2xl font-bold tracking-tight">People</h1><p className="mt-1 text-sm text-black/50 dark:text-white/50">Remember birthdays, gift ideas, and who deserves a message.</p></header>

      <form action={createPerson} className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Add someone</h2>
        <div className="flex flex-wrap gap-2">
          <input name="name" required placeholder="Name" className="min-w-36 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" />
          <input name="relationship" placeholder="Friend, family, colleague…" className="min-w-36 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" />
          <label className="flex items-center gap-2 text-xs text-black/50 dark:text-white/50">Birthday <input name="birthday" type="date" className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm text-foreground dark:border-white/15 dark:[color-scheme:dark]" /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <input name="contact" placeholder="Phone, email, or handle" className="min-w-44 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" />
          <input name="notes" placeholder="What matters to them?" className="min-w-44 flex-[2] rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15" />
          <select name="checkInDays" aria-label="Reconnect cadence" defaultValue="30" className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15 dark:bg-black">{[7, 14, 30, 60, 90].map((days) => <option key={days} value={days}>Check in every {days}d</option>)}</select>
          <button className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">Add person</button>
        </div>
      </form>

      {(birthdays.length > 0 || reconnect.length > 0) && <div className="grid gap-3 sm:grid-cols-2">
        {birthdays[0] && <div className="rounded-xl border border-amber-500/25 bg-amber-500/[.05] p-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"><Cake size={14} /> Birthday coming up</p><p className="mt-2 font-medium">{birthdays[0].name}</p><p className="text-sm text-black/50 dark:text-white/50">{birthdays[0].nextBirthday && formatDay(birthdays[0].nextBirthday)} · {birthdays[0].birthdayInDays === 0 ? "today" : `${birthdays[0].birthdayInDays} days`}</p></div>}
        {reconnect[0] && <div className="rounded-xl border border-black/10 p-4 dark:border-white/10"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45"><MessageCircle size={14} /> Time to reconnect</p><p className="mt-2 font-medium">{reconnect[0].name}</p><p className="text-sm text-black/50 dark:text-white/50">{reconnect[0].daysSinceContact} days since your last check-in.</p></div>}
      </div>}

      {people.length === 0 ? <div className="rounded-xl border border-dashed border-black/15 p-8 text-center dark:border-white/15"><UserRoundPlus className="mx-auto text-black/30 dark:text-white/30" /><p className="mt-3 text-sm text-black/50 dark:text-white/50">Add one person—or try Quick Capture: <span className="font-mono">met Alex</span>.</p></div> : <div className="grid gap-3 sm:grid-cols-2">
        {people.map((person) => <article key={person.itemId} className="group rounded-xl border border-black/10 p-4 dark:border-white/10">
          <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="font-semibold">{person.name}</h2><p className="text-xs text-black/50 dark:text-white/50">{person.payload.relationship || "Person"}{person.payload.contact ? ` · ${person.payload.contact}` : ""}</p></div><form action={deleteItem}><input type="hidden" name="itemId" value={person.itemId} /><button aria-label={`Delete ${person.name}`} className="p-1 text-black/30 opacity-0 hover:text-red-500 group-hover:opacity-100 dark:text-white/30"><X size={14} /></button></form></div>
          {person.payload.birthday && <p className="mt-3 flex items-center gap-2 text-sm"><Cake size={14} className="text-amber-500" /> {person.nextBirthday && formatDay(person.nextBirthday)}</p>}
          {person.payload.notes && <p className="mt-2 text-sm text-black/55 dark:text-white/55">{person.payload.notes}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2"><form action={logPersonContact}><input type="hidden" name="itemId" value={person.itemId} /><button className={`rounded-md px-2 py-1 text-xs ${person.needsContact ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border border-black/10 dark:border-white/10"}`}>Log contact</button></form><span className="text-xs text-black/40 dark:text-white/40">{person.daysSinceContact === 0 ? "contacted today" : `${person.daysSinceContact}d ago`}</span></div>
          {person.payload.giftIdeas.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{person.payload.giftIdeas.map((idea) => <span key={idea} className="rounded-full bg-black/5 px-2 py-1 text-xs dark:bg-white/10">{idea}</span>)}</div>}
          <form action={addGiftIdea} className="mt-3 flex gap-2"><input type="hidden" name="itemId" value={person.itemId} /><div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-black/10 px-2 dark:border-white/10"><Gift size={13} className="shrink-0 text-black/35 dark:text-white/35" /><input name="idea" required placeholder="Gift idea" className="min-w-0 flex-1 bg-transparent py-1.5 text-xs outline-none" /></div><button className="rounded-lg border border-black/10 px-2 text-xs dark:border-white/10">Save</button></form>
        </article>)}
      </div>}
    </div>
  );
}
