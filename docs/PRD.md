# PRD — Post Locking and Real-Time Sync

## Problem

When two people edit the same post at the same time, the last save silently
overwrites the other (lost update). The same happens when one user opens a
post in two tabs. Users cannot see that someone else is editing, and saved
changes do not appear without a page refresh.

## Goals

1. Only **one tab** can edit a post at a time.
2. Everyone else sees the post **read-only** and knows **who** is editing.
3. A saved change appears on every other open screen **immediately**.
4. The lock is **released automatically** after a save, since the editor
   navigates away.
5. The rule is enforced **by the backend**, not only by the UI.

**Non-goals:** collaborative editing (CRDT/OT), field-level locks, offline
editing, lockable resources other than posts.

## User stories

**S1 — First access locks.** Opening a post's detail page sends
`lock:acquire`. If the post is unlocked, the tab gets the lock and the page is
editable. Of two concurrent requests, exactly one wins.

**S2 — Others are read-only.** Another user opening the post gets
`ok: false` with the holder's name and sees "This record is being edited by
X". A REST save from that user is rejected with `423`.

**S3 — Multiple tabs.** The lock belongs to a tab, not a user. The same
user's second tab is read-only with "You are already editing this record in
another tab", and its `PUT` is rejected with `423`.

**S4 — Live sync and unlock.** After a successful save the server emits
`record:changed`, then `lock:released` (`reason: 'saved'`). Viewers refetch
the post, then try to acquire the lock; one of them wins.

**S5 — Abandoned locks.** The lock is released when the tab closes or the
connection drops (within ~15 s), after 5 minutes without `lock:renew`, or
when the user's session is revoked.

**S6 — Delete.** A locked post can only be deleted by the holding tab. An
unlocked post can be deleted by any signed-in user. Viewers receive
`record:changed` (`deleted`) and `lock:released` (`deleted`).

## Requirements

| ID    | Requirement                                                                               |
| ----- | ----------------------------------------------------------------------------------------- |
| FR-1  | At most one lock per record, held by exactly one socket (tab)                             |
| FR-2  | Lock acquisition is atomic                                                                |
| FR-3  | A denied acquire returns the holder's name                                                |
| FR-4  | The same user's other tab gets a distinct message                                         |
| FR-5  | `PUT` requires the holder's `X-Lock-Token`: `428` without a lock, `423` if held elsewhere |
| FR-6  | After a successful update: `record:changed`, then `lock:released(saved)`                  |
| FR-7  | Locks are released on disconnect, after 5 min idle, and on session revocation             |
| FR-8  | A record cannot be locked while a write to it is in flight                                |
| FR-9  | Different spellings of the same id (`'01'`, `'1'`) resolve to one lock                    |
| FR-10 | A socket can hold at most 10 locks                                                        |
| FR-11 | The lock token is returned only to the holder and never broadcast                         |

Any signed-in, active user may lock and update posts; there is no role check.

## Known limitations

| Limitation                                   | Impact                                              |
| -------------------------------------------- | --------------------------------------------------- |
| Lock state is in process memory              | Single instance only; a restart drops every lock    |
| Lock is bound to `socket.id`                 | A brief network drop can lose the lock on reconnect |
| Rooms are per resource type                  | Every post event reaches every post watcher         |
| Each login revokes the user's other sessions | Signing in on a second device signs out the first   |
| `record:changed` carries no data             | Every viewer issues a `GET` to refetch              |
| No post ownership                            | Any signed-in user can delete an unlocked post      |
