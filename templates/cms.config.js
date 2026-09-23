// EXAMPLE ONLY: this file is not loaded by the dashboard or any website.
// During onboarding, place cms.config.js beside the WEBSITE's package.json.
// Reconcile this proposed schema with its SDK and server-side enforcement.
// Use the registered CMS site ID and only fields approved by Issa.
// Adapt the export syntax to the website's module system. No secrets here.
module.exports = {
  siteId: "<registered-site-id>",
  editable: {
    home: ["hero.title", "hero.description", "hero.image"],
  },
};
