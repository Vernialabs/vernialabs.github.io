-- Run these read-only queries in the private Cloudflare D1 console.
-- Browser visit totals come from Cloudflare Web Analytics, with bots excluded.
SELECT date(created_at) AS day, count(*) AS signups
FROM waitlist WHERE status != 'withdrawn' GROUP BY day ORDER BY day DESC;

SELECT json_each.value AS interest, count(*) AS signups
FROM waitlist, json_each(waitlist.interests)
WHERE status != 'withdrawn' GROUP BY interest ORDER BY signups DESC;

SELECT source, campaign, count(*) AS signups
FROM waitlist WHERE status != 'withdrawn' GROUP BY source, campaign ORDER BY signups DESC;

-- FIFO queue. This is private customer information; never publish its output.
SELECT id AS signup_number, email, name, organisation, interests, created_at, status
FROM waitlist WHERE status = 'waiting' ORDER BY id LIMIT 100;
