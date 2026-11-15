// Public configuration only. Never put provider secrets here.
export const siteConfig = Object.freeze({
  waitlistEndpoint: 'https://vernia-waitlist.ishan-upadhyay-iitb.workers.dev/waitlist',
  turnstileSiteKey: '0x4AAAAAAGBrppbjKIgQFtye',
  // Set to true once the Worker in backend/ that accepts the "headset" interest is deployed.
  headsetInterest: false,
});
