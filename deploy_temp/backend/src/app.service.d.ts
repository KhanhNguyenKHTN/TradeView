export declare class AppService {
    getAppInfo(): {
        name: string;
        version: string;
        description: string;
    };
    getHealth(): {
        status: string;
        timestamp: string;
    };
}
