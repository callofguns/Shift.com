// Requests: managers approve/deny, coworkers answer swaps, everyone sees their own.
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useData } from '../hooks/data';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import { Button, Empty, SectionTitle, friendlyError } from '../components/ui';
import { useToast } from '../components/Toast';
import { TimeOffRequest, timeOffFor } from './ShiftSheets';
import { approveRequest, cancelRequest, denyRequest, respondSwap } from '../lib/actions';
import { REQUEST_TITLES, STATUS_LABELS, requestSummary } from '../lib/describe';
import { fmtDateRange, timeAgo } from '../lib/dates';
import { spring } from '../lib/motion';

export default function Requests() {
  const { requests, memberId, isManager } = useData();
  const [askOff, setAskOff] = useState(false);

  const pending = requests.filter((r) => r.status === 'pending');
  const forManagers = isManager ? pending.filter((r) => r.type !== 'swap') : [];
  const swapsForMe = pending.filter((r) => r.type === 'swap' && r.swapWithMemberId === memberId);
  const mine = requests.filter((r) => r.memberId === memberId).slice(0, 25);
  const history = isManager
    ? requests.filter((r) => r.status !== 'pending' && r.status !== 'cancelled' && r.memberId !== memberId).slice(0, 15)
    : [];
  const nothing = !forManagers.length && !swapsForMe.length && !mine.length && !history.length;

  return (
    <>
      <header className="screen-head">
        <div>
          <p className="eyebrow">Requests</p>
          <h1 className="screen-title">{forManagers.length + swapsForMe.length > 0 ? 'Needs an answer' : 'All caught up'}</h1>
        </div>
        <Button variant="secondary" className="btn-small" onClick={() => setAskOff(true)}>
          Time off
        </Button>
      </header>

      {nothing && (
        <Empty icon={<Icon name="inbox" size={30} />} title="No requests yet">
          To change, drop or swap a shift, tap it on the schedule. For days off, tap “Time off” above.
        </Empty>
      )}

      {forManagers.length > 0 && (
        <section className="block">
          <SectionTitle>Needs your OK</SectionTitle>
          <div className="stack-tight">
            <AnimatePresence initial={false}>
              {forManagers.map((r) => (
                <RequestCard key={r.id} rq={r} actions="manager" />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {swapsForMe.length > 0 && (
        <section className="block">
          <SectionTitle>Swap requests for you</SectionTitle>
          <div className="stack-tight">
            <AnimatePresence initial={false}>
              {swapsForMe.map((r) => (
                <RequestCard key={r.id} rq={r} actions="swap" />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {mine.length > 0 && (
        <section className="block">
          <SectionTitle>Your requests</SectionTitle>
          <div className="stack-tight">
            <AnimatePresence initial={false}>
              {mine.map((r) => (
                <RequestCard key={r.id} rq={r} actions="mine" />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="block">
          <SectionTitle>Recently answered</SectionTitle>
          <div className="stack-tight">
            {history.map((r) => (
              <RequestCard key={r.id} rq={r} />
            ))}
          </div>
        </section>
      )}

      <TimeOffRequest open={askOff} onClose={() => setAskOff(false)} />
    </>
  );
}

function RequestCard({ rq, actions }) {
  const { membersById, memberId, requests, timeOff } = useData();
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const who = membersById[rq.memberId];
  const isMine = rq.memberId === memberId;

  const run = async (kind, fn, message) => {
    setBusy(kind);
    try {
      await fn();
      toast(message);
    } catch (err) {
      toast({ title: friendlyError(err), tone: 'error' });
      setBusy('');
    }
  };

  const otherPickups = requests.filter(
    (o) => o.id !== rq.id && o.type === 'pickup' && o.shiftId === rq.shiftId && o.status === 'pending',
  );
  const pickupConflict = rq.type === 'pickup' && rq.shift && timeOffFor(timeOff, rq.memberId, rq.shift.date);

  return (
    <motion.article
      layout
      className="request"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }}
      transition={spring}
    >
      <div className="request-top">
        <Avatar member={who} size={34} />
        <div className="request-text">
          <span className="request-who">
            {isMine ? 'You' : who?.name ?? 'Someone'} <span className="type-chip">{REQUEST_TITLES[rq.type]}</span>
          </span>
          <span className="request-what">{requestSummary(rq, membersById, memberId)}</span>
          {rq.note && <span className="quote">“{rq.note}”</span>}
          {pickupConflict && (
            <span className="request-warn">
              Has time off {fmtDateRange(pickupConflict.startDate, pickupConflict.endDate)}
            </span>
          )}
          {otherPickups.length > 0 && actions === 'manager' && (
            <span className="request-sub">
              Also asked: {otherPickups.map((o) => membersById[o.memberId]?.name).join(', ')}
            </span>
          )}
        </div>
        <span className={`status status-${rq.status}`}>{STATUS_LABELS[rq.status]}</span>
      </div>
      <div className="request-foot">
        <span className="request-time">{timeAgo(rq.createdAt?.toDate?.())}</span>
        {actions === 'manager' && (
          <div className="request-actions">
            <Button variant="ghost" className="btn-small" busy={busy === 'deny'} disabled={Boolean(busy)} onClick={() => run('deny', () => denyRequest(rq.id, memberId), 'Request denied')}>
              Deny
            </Button>
            <Button className="btn-small" busy={busy === 'approve'} disabled={Boolean(busy)} onClick={() => run('approve', () => approveRequest(rq, memberId, otherPickups), 'Approved. The schedule is updated.')}>
              Approve
            </Button>
          </div>
        )}
        {actions === 'swap' && (
          <div className="request-actions">
            <Button variant="ghost" className="btn-small" busy={busy === 'no'} disabled={Boolean(busy)} onClick={() => run('no', () => respondSwap(rq.id, false), 'Swap declined')}>
              No thanks
            </Button>
            <Button className="btn-small" busy={busy === 'yes'} disabled={Boolean(busy)} onClick={() => run('yes', () => respondSwap(rq.id, true), 'Swapped! The schedule is updated.')}>
              Accept swap
            </Button>
          </div>
        )}
        {actions === 'mine' && rq.status === 'pending' && (
          <Button variant="ghost" className="btn-small" busy={busy === 'cancel'} onClick={() => run('cancel', () => cancelRequest(rq.id, memberId), 'Request cancelled')}>
            Cancel request
          </Button>
        )}
      </div>
    </motion.article>
  );
}
