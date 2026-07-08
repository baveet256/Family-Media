import { AppController } from './app.controller';

describe('AppController', () => {
  const appController = new AppController();

  describe('root', () => {
    it('should return API metadata', () => {
      expect(appController.root()).toEqual({
        name: 'Family Media API',
        version: '0.0.1',
        health: '/health',
      });
    });
  });
});
