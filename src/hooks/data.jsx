// Live data from the cloud. When anyone changes something, Firestore pushes the
// update here within a second and every screen re-draws automatically.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../components/Toast';
import { changeSentence, changeTouches } from '../lib/describe';

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

const DEFAULT_SETTINGS = {
  positions: ['Cashier'],
  presets: [
    { id: 'morning', label: 'Morning', start: '08:00', end: '15:00' },
    { id: 'evening', label: 'Evening', start: '15:00', end: '22:00' },
  ],
};

const SEEN_KEY = 'georges.changesSeenAt';

// The first time someone opens the app on a phone, older changes don't count as new.
function readSeen() {
  try {
    const stored = Number(localStorage.getItem(SEEN_KEY));
    if (stored) return stored;
    const now = Date.now();
    localStorage.setItem(SEEN_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

function withId(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function DataProvider({ memberId, children }) {
  const [membersById, setMembersById] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [timeOff, setTimeOff] = useState([]);
  const [requests, setRequests] = useState(null);
  const [changes, setChanges] = useState(null);
  const [seenAt, setSeenAt] = useState(readSeen);
  const toast = useToast();

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'members'), (snap) => {
        const map = {};
        snap.docs.forEach((d) => (map[d.id] = { id: d.id, ...d.data() }));
        setMembersById(map);
      }),
      onSnapshot(doc(db, 'settings', 'app'), (snap) => {
        if (snap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...snap.data() });
      }),
      onSnapshot(collection(db, 'timeOff'), (snap) => setTimeOff(withId(snap).filter((t) => !t.deleted))),
      onSnapshot(query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(200)), (snap) =>
        setRequests(withId(snap)),
      ),
      onSnapshot(query(collection(db, 'changes'), orderBy('createdAt', 'desc'), limit(100)), (snap) =>
        setChanges(withId(snap)),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const me = membersById?.[memberId] ?? null;
  const members = useMemo(
    () =>
      Object.values(membersById ?? {})
        .filter((m) => m.active)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [membersById],
  );

  // Pop up a message inside the app when the schedule changes while it's open.
  const knownChanges = useRef(null);
  useEffect(() => {
    if (!membersById || !me || changes === null) return;
    const ids = new Set(changes.map((c) => c.id));
    if (knownChanges.current) {
      const fresh = changes.filter(
        (c) => !knownChanges.current.has(c.id) && c.actorId !== memberId && c.createdAt,
      );
      fresh
        .filter((c) => me.notify === 'all' || changeTouches(c, memberId))
        .slice(0, 3)
        .forEach((c) => toast({ title: 'Schedule change', body: changeSentence(c, membersById, memberId), href: '#changes' }));
    }
    knownChanges.current = ids;
  }, [changes, membersById, me, memberId, toast]);

  const knownRequests = useRef(null);
  useEffect(() => {
    if (!membersById || !me || requests === null) return;
    const pending = requests.filter((r) => r.status === 'pending');
    if (knownRequests.current) {
      pending
        .filter((r) => !knownRequests.current.has(r.id) && r.memberId !== memberId)
        .forEach((r) => {
          const who = membersById[r.memberId]?.name ?? 'Someone';
          if (r.type === 'swap' && r.swapWithMemberId === memberId) {
            toast({ title: 'Swap request', body: `${who} wants to swap a shift with you.`, href: '#requests' });
          } else if (r.type !== 'swap' && me.role === 'manager') {
            toast({ title: 'New request', body: `${who} sent a request.`, href: '#requests' });
          }
        });
    }
    knownRequests.current = new Set(pending.map((r) => r.id));
  }, [requests, membersById, me, memberId, toast]);

  const unseenChanges = (changes ?? []).filter(
    (c) => c.actorId !== memberId && (c.createdAt?.toMillis?.() ?? 0) > seenAt,
  ).length;

  const markChangesSeen = () => {
    const now = Date.now();
    setSeenAt(now);
    try {
      localStorage.setItem(SEEN_KEY, String(now));
    } catch {
      // Storage blocked: the badge just resets next time.
    }
  };

  const pendingForMe = (requests ?? []).filter(
    (r) =>
      r.status === 'pending' &&
      ((r.type === 'swap' && r.swapWithMemberId === memberId) ||
        (r.type !== 'swap' && me?.role === 'manager' && r.memberId !== memberId)),
  ).length;

  const value = {
    ready: Boolean(membersById),
    memberId,
    me,
    isManager: me?.role === 'manager',
    membersById: membersById ?? {},
    members,
    settings,
    timeOff,
    requests: requests ?? [],
    changes: changes ?? [],
    changesLoaded: changes !== null,
    unseenChanges,
    markChangesSeen,
    seenAt,
    pendingForMe,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// Shifts between two day keys (inclusive), kept live.
export function useShifts(fromKey, toKey) {
  const [shifts, setShifts] = useState(null);
  useEffect(() => {
    setShifts(null);
    const q = query(collection(db, 'shifts'), where('date', '>=', fromKey), where('date', '<=', toKey));
    return onSnapshot(q, (snap) =>
      setShifts(
        withId(snap)
          .filter((s) => !s.deleted)
          .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
      ),
    );
  }, [fromKey, toKey]);
  return shifts;
}
