

## Verification Plan: Card Level System

### Current State (Verified)
- Profile ID: `3493ea6f-1791-487a-add2-6d1e55f34eaa`
- User ID: `25d484e6-5a11-45e5-b5c4-8611d8f809c4b`
- Current level: **ROOKIE** (0 milestones) — Step 1 PASS

### Step 2: Insert 4 milestones → STARTER
Insert 4 rows into `participant_milestones` using real milestone definition IDs from the seed data, then call `recalculate_card_level()` RPC. After this, the card should show **STARTER** in blue.

```sql
INSERT INTO participant_milestones (participant_id, milestone_id, unlocked_by) VALUES
  ('3493ea6f-1791-487a-add2-6d1e55f34eaa', 'aa92a259-13b3-4612-935e-21fa9b809c4b', '25d484e6-5a11-45e5-b5c4-8611d8f52618'),
  ('3493ea6f-1791-487a-add2-6d1e55f34eaa', '099dc9f0-d069-4adb-a9da-aa2613351d89', '25d484e6-5a11-45e5-b5c4-8611d8f52618'),
  ('3493ea6f-1791-487a-add2-6d1e55f34eaa', '93269c08-eee1-4b84-bdd8-043e893aa770', '25d484e6-5a11-45e5-b5c4-8611d8f52618'),
  ('3493ea6f-1791-487a-add2-6d1e55f34eaa', '7c1241da-6054-4071-a032-42e1a71a8bee', '25d484e6-5a11-45e5-b5c4-8611d8f52618');

SELECT recalculate_card_level('3493ea6f-1791-487a-add2-6d1e55f34eaa');
```

### Step 3: Real-time test
With the card page open, insert a 5th milestone. The badge should update live without refresh.

```sql
INSERT INTO participant_milestones (participant_id, milestone_id, unlocked_by) VALUES
  ('3493ea6f-1791-487a-add2-6d1e55f34eaa', '1b1582fa-0841-4fd5-a162-fe833ad158a7', '25d484e6-5a11-45e5-b5c4-8611d8f52618');

SELECT recalculate_card_level('3493ea6f-1791-487a-add2-6d1e55f34eaa');
```

### Step 4: Toast notification
The level-up toast ("You've reached STARTER level!") should appear on the real-time update.

### What I'll do
Once approved, I'll execute these SQL statements using the database insert tool and you can watch the card page update in real time.

