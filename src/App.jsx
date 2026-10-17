import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useSession } from './hooks/useSession';
import { DataProvider, useData } from './hooks/data';
import { ToastProvider } from './components/Toast';
import TabBar, { TABS } from './components/TabBar';
import Login from './screens/Login';
import { Bootstrap, Disabled, NotInvited, SessionError, Splash, VerifyEmail } from './screens/Gates';
import Schedule from './screens/Schedule';
import MyShifts from './screens/MyShifts';
import Requests from './screens/Requests';
import Changes from './screens/Changes';
import More from './screens/More';
import { refreshPush } from './lib/push';
import { spring } from './lib/motion';

export default function App() {
  return (
    // "user" = respect the phone's "Reduce motion" setting.
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <Root />
      </ToastProvider>
    </MotionConfig>
  );
}

function Root() {
  const session = useSession();
  let screen;
  switch (session.status) {
    case 'loading':
      screen = <Splash key="splash" />;
      break;
    case 'signed-out':
      screen = <Login key="login" />;
      break;
    case 'verify-email':
      screen = <VerifyEmail key="verify" session={session} />;
      break;
    case 'not-invited':
      screen = <NotInvited key="not-invited" session={session} />;
      break;
    case 'bootstrap':
      screen = <Bootstrap key="bootstrap" session={session} />;
      break;
    case 'error':
      screen = <SessionError key="error" session={session} />;
      break;
    default:
      screen = (
        <DataProvider key="app" memberId={session.memberId}>
          <Shell session={session} />
        </DataProvider>
      );
  }
  return <AnimatePresence mode="wait">{screen}</AnimatePresence>;
}

function readTab() {
  const id = window.location.hash.replace('#', '');
  return TABS.some((t) => t.id === id) ? id : 'schedule';
}

function Shell({ session }) {
  const data = useData();
  const [tab, setTab] = useState(readTab);
  const [direction, setDirection] = useState(0);
  const current = useRef(tab);

  // The address bar remembers the tab (#changes), so notifications can open the right one.
  useEffect(() => {
    const index = (id) => TABS.findIndex((t) => t.id === id);
    const onHash = () => {
      const next = readTab();
      setDirection(index(next) - index(current.current));
      current.current = next;
      setTab(next);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    refreshPush(session.memberId);
  }, [session.memberId]);

  const go = (id) => {
    if (id === tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.location.hash = id;
  };

  if (!data.ready) return <Splash />;
  if (!data.me || !data.me.active) return <Disabled session={session} />;

  const screens = {
    schedule: <Schedule />,
    mine: <MyShifts />,
    requests: <Requests />,
    changes: <Changes />,
    more: <More session={session} />,
  };

  return (
    <motion.div className="shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.main
          key={tab}
          className="screen"
          custom={direction}
          variants={{
            enter: (d) => ({ opacity: 0, x: d > 0 ? 28 : d < 0 ? -28 : 0 }),
            center: { opacity: 1, x: 0 },
            exit: (d) => ({ opacity: 0, x: d > 0 ? -28 : d < 0 ? 28 : 0, transition: { duration: 0.12 } }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={spring}
        >
          {screens[tab]}
        </motion.main>
      </AnimatePresence>
      <TabBar
        current={tab}
        onChange={go}
        badges={{ changes: tab === 'changes' ? 0 : data.unseenChanges, requests: data.pendingForMe }}
      />
    </motion.div>
  );
}
