import BasicResources from './BasicResources';
import { Router } from 'express';

export default function(router: Router): void {
  router.use('/hsr', BasicResources);
}