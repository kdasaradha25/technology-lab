const { Router } = require('express');
const controller = require('../controllers/health.controller');

const router = Router();

router.get('/health', controller.health);
router.get('/health/app', controller.healthApp);
router.get('/health/db', controller.healthDb);

module.exports = router;
