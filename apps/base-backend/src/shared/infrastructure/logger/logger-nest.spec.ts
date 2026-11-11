import { PinoLogger } from 'nestjs-pino';
import { LoggerNest } from './logger-nest.js';

describe('LoggerNest', () => {
  const crear = () => {
    const info = vi.fn();
    const pino = { info, setContext: vi.fn() } as unknown as PinoLogger;
    return { logger: new LoggerNest(pino, {}), info };
  };

  it.each(['InstanceLoader', 'RoutesResolver', 'RouterExplorer'])(
    'no escribe los avisos de arranque de %s',
    (contexto) => {
      const { logger, info } = crear();
      logger.log('Mapped {/api/v1/x, GET} route', contexto);
      expect(info).not.toHaveBeenCalled();
    },
  );

  it('escribe lo demás', () => {
    const { logger, info } = crear();
    logger.log('Conectado a la base de datos', 'PrismaService');
    expect(info).toHaveBeenCalledOnce();
  });
});
