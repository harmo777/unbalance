(function () {
    'use strict';

    angular
        .module('app.dashboard')
        .controller('Dashboard', Dashboard);

    /* @ngInject */
    function Dashboard($scope, $state, $q, api, socket, logger, options) {

        /*jshint validthis: true */
        var vm = this;

        vm.options = options;

        vm.condition = {};
        vm.disks = [];
        vm.commands = [];

        vm.toDisk = [];
        vm.fromDisk = [];

        vm.maxFreeSize = 0;
        vm.maxFreePath = 0;             

        vm.getStatus = getStatus;
        vm.calculateBestFit = calculateBestFit;
        vm.move = move;
        vm.checkFrom = checkFrom;
        vm.checkTo = checkTo;
        vm.flipDryRun = flipDryRun;

        vm.moveStarted = false
        vm.disableControls = false;
        vm.showProgress = false;
        vm.lines = [];

        socket.register("storage:move:begin", storageMoveBegin);
        socket.register("storage:move:progress", storageMoveProgress);
        socket.register("storage:move:end", storageMoveEnd);
        socket.register("storage:update:completed", storageUpdate);

        activate();

        function activate() {
            return getStatus().then(function() {
                console.log('activated dashboard view');
            });
        };

        function getStatus() {
            return api.getStatus().then(function (data) {
//                logger.info('what is: ', data);

                vm.disableControls = false;
                vm.moveStarted = false;      
                vm.showProgress = false;          

                vm.condition = data.condition;
                vm.ok = vm.condition.state === "STARTED";

                vm.maxFreeSize = 0;
                vm.maxFreePath = 0;

                if (vm.ok) {
                    vm.disks = data.disks.map(function(disk) {
                        vm.toDisk[disk.path] = true;
                        vm.fromDisk[disk.path] = false;

                        if (disk.free > vm.maxFreeSize) {
                            vm.maxFreeSize = disk.free;
                            vm.maxFreePath = disk.path;
                        }

                        return disk;
                    });

                    if (vm.maxFreePath != "") {
                        vm.toDisk[vm.maxFreePath] = false;
                        vm.fromDisk[vm.maxFreePath] = true;
                    }                

                    return vm.disks;
                } else {
                    vm.disableControls = true;
                }
            });
        };

        function calculateBestFit() {
            var srcDisk = "";

            for (var key in vm.fromDisk) {
                if (vm.fromDisk.hasOwnProperty(key)) {
                    if (vm.fromDisk[key]) {
                        srcDisk = key;
                        break;
                    }
                }
            }

            if (srcDisk === "") {
                logger.warning("You need to select a source disk");
                return;
            }

            return api.calculateBestFit({"sourceDisk": srcDisk, "destDisk": ""}).then(function(data) {
                vm.condition = data.condition;

                if (vm.condition.free === vm.condition.newFree) {
                    logger.info("Nothing to do");
                }

                vm.disks = data.disks;

                return vm.disks;                
            });
        };

        function move() {
            socket.send("storage:move");

            // return api.move().then(function(data) {
            //     vm.commands = data;
            //     logger.info("Scroll down to see list of commands");
            //     return vm.commands;
            // });
        };

        function checkFrom(from) {
            for (var key in vm.fromDisk) {
                if (key !== from) {
                    vm.fromDisk[key] = false;
                }
            };

            for (var key in vm.toDisk) {
                vm.toDisk[key] = !(key === from);
            };            

        };

        function checkTo(to) {
            return;
        };

        function flipDryRun() {
            vm.options.config.dryRun != vm.options.config.dryRun;

            return api.saveConfig(vm.options.config).then(function(data) {
                logger.success('config saved succesfully');
            });            
        };

        function storageMoveBegin(data) {
            vm.lines.push("Move operation started ...");
            
            vm.disableControls = true;
            vm.moveStarted = true;
            vm.showProgress = true;

        };

        function storageMoveProgress(data) {
            vm.lines.push(data);
        };

        function storageMoveEnd(data) {
            vm.disableControls = false;
            vm.showProgress = false;

            vm.lines.push("Move operation completed.");

            if (!vm.options.config.dryRun) {
                socket.send("storage:update");
            }
        };

        function storageUpdate(data) {
            vm.condition = data.condition;

            vm.maxFreeSize = 0;
            vm.maxFreePath = 0;

            vm.disks = [];
            vm.disks = data.disks.map(function(disk) {
                vm.toDisk[disk.path] = true;
                vm.fromDisk[disk.path] = false;

                if (disk.free > vm.maxFreeSize) {
                    vm.maxFreeSize = disk.free;
                    vm.maxFreePath = disk.path;
                }

                return disk;
            });

            if (vm.maxFreePath != "") {
                vm.toDisk[vm.maxFreePath] = false;
                vm.fromDisk[vm.maxFreePath] = true;
            }
        }

    }
})();