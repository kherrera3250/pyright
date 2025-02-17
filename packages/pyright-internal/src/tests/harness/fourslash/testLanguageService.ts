/*
 * testLanguageService.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Test mock that implements LanguageServiceInterface
 */

import * as path from 'path';
import { CancellationToken, CodeAction, ExecuteCommandParams } from 'vscode-languageserver';

import {
    BackgroundAnalysisProgram,
    BackgroundAnalysisProgramFactory,
} from '../../../analyzer/backgroundAnalysisProgram';
import { CacheManager } from '../../../analyzer/cacheManager';
import { ImportResolver, ImportResolverFactory } from '../../../analyzer/importResolver';
import { MaxAnalysisTime } from '../../../analyzer/program';
import { AnalyzerService } from '../../../analyzer/service';
import { BackgroundAnalysisBase } from '../../../backgroundAnalysisBase';
import { CommandController } from '../../../commands/commandController';
import { ConfigOptions } from '../../../common/configOptions';
import { ConsoleInterface } from '../../../common/console';
import * as debug from '../../../common/debug';
import { FileSystem } from '../../../common/fileSystem';
import { Range } from '../../../common/textRange';
import { UriParser } from '../../../common/uriParser';
import { LanguageServerInterface, MessageAction, ServerSettings, WindowInterface } from '../../../languageServerBase';
import { CodeActionProvider } from '../../../languageService/codeActionProvider';
import {
    WellKnownWorkspaceKinds,
    Workspace,
    WorkspacePythonPathKind,
    createInitStatus,
} from '../../../workspaceFactory';
import { TestAccessHost } from '../testAccessHost';
import { HostSpecificFeatures } from './testState';
import { ServiceProvider } from '../../../common/serviceProvider';

export class TestFeatures implements HostSpecificFeatures {
    importResolverFactory: ImportResolverFactory = AnalyzerService.createImportResolver;
    backgroundAnalysisProgramFactory: BackgroundAnalysisProgramFactory = (
        serviceId: string,
        serviceProvider: ServiceProvider,
        configOptions: ConfigOptions,
        importResolver: ImportResolver,
        backgroundAnalysis?: BackgroundAnalysisBase,
        maxAnalysisTime?: MaxAnalysisTime,
        cacheManager?: CacheManager
    ) =>
        new BackgroundAnalysisProgram(
            serviceId,
            serviceProvider,
            configOptions,
            importResolver,
            backgroundAnalysis,
            maxAnalysisTime,
            /* disableChecker */ undefined,
            cacheManager
        );

    runIndexer(workspace: Workspace, noStdLib: boolean, options?: string): void {
        /* empty */
    }

    getCodeActionsForPosition(
        workspace: Workspace,
        filePath: string,
        range: Range,
        token: CancellationToken
    ): Promise<CodeAction[]> {
        return CodeActionProvider.getCodeActionsForPosition(workspace, filePath, range, undefined, token);
    }
    execute(ls: LanguageServerInterface, params: ExecuteCommandParams, token: CancellationToken): Promise<any> {
        const controller = new CommandController(ls);
        return controller.execute(params, token);
    }
}

export class TestLanguageService implements LanguageServerInterface {
    readonly rootPath = path.sep;
    readonly window = new TestWindow();
    readonly supportAdvancedEdits = true;

    private readonly _workspace: Workspace;
    private readonly _defaultWorkspace: Workspace;
    private readonly _uriParser: UriParser;

    constructor(workspace: Workspace, readonly console: ConsoleInterface, readonly fs: FileSystem) {
        this._workspace = workspace;
        this._uriParser = new UriParser(this.fs);
        this._defaultWorkspace = {
            workspaceName: '',
            rootPath: '',
            uri: '',
            pythonPath: undefined,
            pythonPathKind: WorkspacePythonPathKind.Mutable,
            kinds: [WellKnownWorkspaceKinds.Test],
            service: new AnalyzerService('test service', new ServiceProvider(), {
                console: this.console,
                hostFactory: () => new TestAccessHost(),
                importResolverFactory: AnalyzerService.createImportResolver,
                configOptions: new ConfigOptions('.'),
                fileSystem: this.fs,
            }),
            disableLanguageServices: false,
            disableOrganizeImports: false,
            disableWorkspaceSymbol: false,
            isInitialized: createInitStatus(),
            searchPathsToWatch: [],
            pythonEnvironmentName: undefined,
        };
    }

    decodeTextDocumentUri(uriString: string): string {
        return this._uriParser.decodeTextDocumentUri(uriString);
    }

    getWorkspaces(): Promise<Workspace[]> {
        return Promise.resolve([this._workspace, this._defaultWorkspace]);
    }

    getWorkspaceForFile(filePath: string): Promise<Workspace> {
        if (filePath.startsWith(this._workspace.rootPath)) {
            return Promise.resolve(this._workspace);
        }

        return Promise.resolve(this._defaultWorkspace);
    }

    getSettings(_workspace: Workspace): Promise<ServerSettings> {
        const settings: ServerSettings = {
            venvPath: this._workspace.service.getConfigOptions().venvPath,
            pythonPath: this._workspace.service.getConfigOptions().pythonPath,
            typeshedPath: this._workspace.service.getConfigOptions().typeshedPath,
            openFilesOnly: this._workspace.service.getConfigOptions().checkOnlyOpenFiles,
            useLibraryCodeForTypes: this._workspace.service.getConfigOptions().useLibraryCodeForTypes,
            disableLanguageServices: this._workspace.disableLanguageServices,
            autoImportCompletions: this._workspace.service.getConfigOptions().autoImportCompletions,
            functionSignatureDisplay: this._workspace.service.getConfigOptions().functionSignatureDisplay,
        };

        return Promise.resolve(settings);
    }

    createBackgroundAnalysis(serviceId: string): BackgroundAnalysisBase | undefined {
        // worker thread doesn't work in Jest
        // by returning undefined, analysis will run inline
        return undefined;
    }

    reanalyze(): void {
        // Don't do anything
    }

    restart(): void {
        // Don't do anything
    }
}

class TestWindow implements WindowInterface {
    showErrorMessage(message: string): void;
    showErrorMessage(message: string, ...actions: MessageAction[]): Promise<MessageAction | undefined>;
    showErrorMessage(message: string, ...actions: MessageAction[]): Promise<MessageAction | undefined> | void {
        debug.fail("shouldn't be called");
    }

    showWarningMessage(message: string): void;
    showWarningMessage(message: string, ...actions: MessageAction[]): Promise<MessageAction | undefined>;
    showWarningMessage(message: string, ...actions: MessageAction[]): Promise<MessageAction | undefined> | void {
        debug.fail("shouldn't be called");
    }

    showInformationMessage(message: string): void;
    showInformationMessage(message: string, ...actions: MessageAction[]): Promise<MessageAction | undefined>;
    showInformationMessage(message: string, ...actions: MessageAction[]): Promise<MessageAction | undefined> | void {
        // Don't do anything
    }
}
