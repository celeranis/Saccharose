import { NextFunction, Request, Response, Router } from 'express';
import { create } from '../../routing/router.ts';
import { SiteUserProvider } from '../../middleware/auth/SiteUserProvider.ts';

export default async function(): Promise<Router> {
  const router: Router = create();

  router.get('/privacy', async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || await SiteUserProvider.isBanned(req.user)) {
      return res.render('pages/generic/legaldocs/privacy-policy', {
        title: 'Privacy Policy',
        layouts: ['layouts/basic-layout'],
        bodyClass: ['page--docs'],
      });
    } else {
      return res.render('pages/generic/legaldocs/privacy-policy', {
        title: 'Privacy Policy',
        layouts: ['layouts/app-layout'],
        bodyClass: ['page--docs'],
      });
    }
  });

  router.get('/terms', async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || await SiteUserProvider.isBanned(req.user)) {
      return res.render('pages/generic/legaldocs/terms-of-service', {
        title: 'Terms of Service',
        layouts: ['layouts/basic-layout'],
        bodyClass: ['page--docs'],
      });
    } else {
      return res.render('pages/generic/legaldocs/terms-of-service', {
        title: 'Terms of Service',
        layouts: ['layouts/app-layout'],
        bodyClass: ['page--docs'],
      });
    }
  });

  router.get('/contact', async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || await SiteUserProvider.isBanned(req.user)) {
      return res.render('pages/generic/legaldocs/contact', {
        title: 'Contact',
        layouts: ['layouts/basic-layout'],
        bodyClass: ['page--docs'],
      });
    } else {
      return res.render('pages/generic/legaldocs/contact', {
        title: 'Contact',
        layouts: ['layouts/app-layout'],
        bodyClass: ['page--docs'],
      });
    }
  });

  router.get('/OL', async (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.render('pages/generic/basic/olgen', {
      title: 'OL',
      layouts: ['layouts/basic-layout', 'layouts/visitor-wrapper'],
      bodyClass: ['page--OL']
    });
  });
  router.get(['/hsr/OL', '/zenless/OL', '/wuwa/OL'], async (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.render('pages/generic/basic/olgen', {
      title: 'OL',
      layouts: ['layouts/basic-layout', 'layouts/visitor-wrapper'],
      bodyClass: ['page--OL'],
      hideTlOption: true
    });
  });

  return router;
}
