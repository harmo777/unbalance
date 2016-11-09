package lib

import (
	// "errors"
	"fmt"
	"github.com/namsral/flag"
	"os"
	"strings"
)

// ReservedSpace -
const ReservedSpace = 450000000 // 450Mb

// Config -
type Config struct {
	Folders        []string `json:"folders"`
	DryRun         bool     `json:"dryRun"`
	NotifyCalc     int      `json:"notifyCalc"`
	NotifyMove     int      `json:"notifyMove"`
	ReservedAmount int64    `json:"reservedAmount"`
	ReservedUnit   string   `json:"reservedUnit"`
	RsyncFlags     []string `json:"rsyncFlags"`
	Version        string   `json:"version"`
}

// NotifyCalc/NotifyMove possible values
// 0 - no notification
// 1 - simple notification
// 2 - detailed notification

// Settings -
type Settings struct {
	Config

	Conf       string
	Port       string
	Log        string
	APIFolders []string
	// ReservedSpace int64
}

// NewSettings -
func NewSettings(version string) (*Settings, error) {
	var config, port, log, folders, rsyncFlags, apiFolders string
	var dryRun bool
	var notifyCalc, notifyMove int

	// location := SearchFile(name, locations)
	// if location != "" {
	// 	flag.Set("config", filepath.Join(location, name))
	// }

	// /boot/config/plugins/unbalance/
	flag.StringVar(&config, "config", "", "config location")
	flag.StringVar(&port, "port", "6237", "port to run the server")
	flag.StringVar(&log, "log", "/boot/logs/unbalance.log", "pathname where log file will be written to")
	flag.StringVar(&folders, "folders", "", "folders that will be scanned for media")
	flag.BoolVar(&dryRun, "dryRun", true, "perform a dry-run rather than actual work")
	flag.IntVar(&notifyCalc, "notifyCalc", 0, "notify via email after calculation operation has completed (unraid notifications must be set up first): 0 - No notifications; 1 - Simple notifications; 2 - Detailed notifications")
	flag.IntVar(&notifyMove, "notifyMove", 0, "notify via email after move operation has completed (unraid notifications must be set up first): 0 - No notifications; 1 - Simple notifications; 2 - Detailed notifications")
	flag.StringVar(&rsyncFlags, "rsyncFlags", "", "custom rsync flags")
	flag.StringVar(&apiFolders, "apiFolders", "/var/local/emhttp", "folders to look for api endpoints")

	flag.Set("config", "/boot/config/plugins/unbalance/unbalance.conf")
	flag.Parse()

	// fmt.Printf("folders: %s\nconfig: %s\n", folders, config)

	s := &Settings{}

	if folders == "" {
		s.Folders = make([]string, 0)
	} else {
		s.Folders = strings.Split(folders, "|")
	}

	if rsyncFlags == "" {
		s.RsyncFlags = []string{"-avRX", "--partial"}
	} else {
		s.RsyncFlags = strings.Split(rsyncFlags, "|")
	}

	s.DryRun = dryRun
	s.NotifyCalc = notifyCalc
	s.NotifyMove = notifyMove
	s.ReservedAmount = ReservedSpace / 1000 / 1000
	s.ReservedUnit = "Mb"
	s.Version = version

	s.Conf = config
	s.Port = port
	s.Log = log
	s.APIFolders = strings.Split(apiFolders, "|")

	return s, nil
}

// AddFolder -
func (s *Settings) AddFolder(folder string) {
	s.Folders = append(s.Folders, folder)
}

// DeleteFolder -
func (s *Settings) DeleteFolder(folder string) {

	index := -1
	for p, v := range s.Folders {
		if v == folder {
			index = p
			break
		}
	}

	if index == -1 {
		return
	}

	s.Folders = append(s.Folders[:index], s.Folders[index+1:]...)
}

// ToggleDryRun -
func (s *Settings) ToggleDryRun() {
	s.DryRun = !s.DryRun
}

// Save -
func (s *Settings) Save() (err error) {
	tmpFile := s.Conf + ".tmp"

	folders := strings.Join(s.Folders, "|")
	if err = WriteLine(tmpFile, fmt.Sprintf("folders=%s", folders)); err != nil {
		return err
	}

	if err = WriteLine(tmpFile, fmt.Sprintf("dryRun=%t", s.DryRun)); err != nil {
		return err
	}

	if err = WriteLine(tmpFile, fmt.Sprintf("notifyCalc=%d", s.NotifyCalc)); err != nil {
		return err
	}

	if err = WriteLine(tmpFile, fmt.Sprintf("notifyMove=%d", s.NotifyCalc)); err != nil {
		return err
	}

	rsyncFlags := strings.Join(s.RsyncFlags, "|")
	if err = WriteLine(tmpFile, fmt.Sprintf("rsyncFlags=%s", rsyncFlags)); err != nil {
		return err
	}

	os.Rename(tmpFile, s.Conf)

	return
}