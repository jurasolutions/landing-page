/**
 * Every word the product photo studio uses. The direction change
 * (.scratch/food-post-maker/reviews/direction-change.md) sets the progress
 * message, the AI note, the privacy note and the example instructions, used
 * verbatim. Everything else follows design-system/README.md §3.
 */
export default {
  title: "Product photo studio",
  subtitle:
    "Add a photo of your product and get three posts with better light, a fresh background and a caption ready to use.",
  privacy:
    "Your photos are sent securely to Anthropic's Claude, which writes the captions and picture instructions, and to Cloudflare Workers AI, which draws the new pictures from them. Neither keeps them for us, and we don't store your photos or the results. Product photos work best. Leave out photos with people in them.",
  talk: {
    heading: "Product pictures and posts, every week",
    body: "We can set this up to make pictures and captions for your new products each week, ready for you to check and post.",
    button: "Show us how you post today",
  },

  triesLeft: (n) => (n === 1 ? "1 free try left today" : `${n} free tries left today`),
  limitReached:
    "You've used today's free tries. Come back tomorrow, or tell us how you make your posts and we'll show you the full version.",
  capReached:
    "The free tries are used up for today. Come back tomorrow, or tell us what you need and we'll show you the full version.",

  uploadLabel: "Add your product photos",
  uploadHint: "Add up to 4 photos of your products. Clear, well-lit photos work best.",
  preparing: "Getting your photo ready",
  files: {
    label: (n) => `Photo ${n}`,
    remove: (n) => `Remove photo ${n}`,
  },
  heic: "Please share the photo as a JPG.",
  tooMany: "You can add up to 4 photos at a time.",
  badType: "That file can't be read here. Use a JPG, PNG or WEBP photo.",
  tooBig: "That photo is too large to send, even after resizing. Try a smaller photo.",
  unopenable: "That photo couldn't be opened. Try another one.",

  instruction: "How the pictures should look",
  instructionHint: "Optional. Describe it in your own words, or tap an example.",
  examplesLabel: "Examples",
  examples: [
    "Remove the background and put it on clean white",
    "Put these products together in one picture",
    "Place it on a marble counter in soft morning light",
    "Bright, colourful background for a weekend sale post",
    "Lifestyle shot on a wooden table with plants around it",
    "Dark, moody background with a spotlight on the product",
  ],
  name: "Business name",
  nameHint: "Optional. Shown on the posts and used in the captions.",

  make: "Make my posts",
  making: "Making your posts…",
  oneTry: "One try makes three posts from everything you've added.",
  progress: "Lighting your products and drawing three posts. This can take up to a minute.",
  // Why the button is off. Only the reasons nothing else on the page explains.
  makeWhy: {
    loading: "Checking your free tries for today…",
    preparing: "Your photos are still getting ready.",
    noPhotos: "Add at least one product photo first.",
  },

  errors: {
    noProduct: "We couldn't find a product in these photos. Add a clear photo of the product you want to post.",
    unreadable: "We couldn't make posts from these photos. A clear, well-lit photo of your product usually works.",
    unavailable: "The product photo studio isn't available right now. Please try again later.",
    // Added after either message above, only when the try came back.
    notCounted: "This try wasn't counted.",
    botCheck: "We couldn't confirm this is a person and not a bot. Refresh the page and try again.",
    notReady: "The product photo studio isn't available right now. Please try again later.",
  },

  results: {
    products: "What we found in your photos",
    heading: "Your posts",
    hint: "Choose the ones you like. Pick a caption for each, edit it if you want, then save the picture and copy the caption.",
    post: (n) => `Post ${n}`,
    yourBusiness: "Your business",
    choose: "Choose this one",
    captions: "Caption",
    captionOption: (n) => `Caption ${n}`,
    edit: "Edit caption",
    done: "Done",
    editLabel: (n) => `Caption for post ${n}`,
    aiNote: "This picture is made by AI from your photos. Check your product looks right before you post.",
    noPicture: "We couldn't draw this picture. The caption is still yours to use.",
    pictureLost: "This picture wasn't kept when the page reloaded. The caption is still yours to use.",
    picturesLost: "The pictures weren't kept when this page reloaded. Your captions are still here.",
    picturesNotKept: "These pictures won't be kept if this page reloads. Save the ones you want now.",
    shape: "Picture shape",
    portrait: "Portrait",
    square: "Square",
    download: "Download picture",
    share: "Save or share",
    saving: "Saving the picture…",
    copy: "Copy caption",
    copied: "Caption copied",
    copyFailed: "Your browser didn't allow copying. Use Edit caption, then select the words and copy them.",
    saveFailed: "The picture couldn't be saved. Please try again.",
    startAgain: "Start again",
    confirmClear: "This clears all three posts from this page. Save the pictures and copy the captions you want first.",
    clear: "Clear my posts",
    keep: "Keep my posts",
  },
};
